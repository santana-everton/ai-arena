import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { DEFAULT_MTGA_LOG_RELATIVE, MTGA_LOG_CANDIDATES } from './config'

export type LogSearchResult = {
  path: string
  size: number
  lastModified: Date
  confidence: number
  matches: string[]
}

const LOG_FILE_NAMES = Array.from(
  new Set(MTGA_LOG_CANDIDATES.map(candidate => path.basename(candidate)))
)

/**
 * Busca por arquivos de log do MTGA em locais comuns
 */
export function searchCommonLocations(): string[] {
  const homeDir = os.homedir()
  const mtgaBaseDir = path.join(homeDir, ...DEFAULT_MTGA_LOG_RELATIVE)
  const candidatePaths = new Set<string>()

  const appendPathsForBase = (baseDir: string) => {
    for (const fileName of LOG_FILE_NAMES) {
      candidatePaths.add(path.join(baseDir, fileName))
    }
  }

  appendPathsForBase(mtgaBaseDir)

  const alternativeBases = [
    path.join(homeDir, 'AppData', 'Local', 'Wizards Of The Coast', 'MTGA'),
    path.join(homeDir, 'Documents', 'MTGA'),
    path.join(homeDir, 'Documents', 'Wizards Of The Coast', 'MTGA'),
    path.join(homeDir, 'AppData', 'Roaming', 'Wizards Of The Coast', 'MTGA'),
    // Diretório do Steam MTGA
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\MTGA\\MTGA_Data\\Logs\\Logs',
  ]

  for (const baseDir of alternativeBases) {
    try {
      if (fs.existsSync(baseDir)) {
        // Se for o diretório do Steam, procurar por todos os arquivos .log
        if (baseDir.includes('Steam') && baseDir.includes('Logs')) {
          const files = fs.readdirSync(baseDir)
          const logFiles = files
            .filter((file) => file.toLowerCase().endsWith('.log'))
            .map((file) => path.join(baseDir, file))
          for (const logFile of logFiles) {
            candidatePaths.add(logFile)
          }
        } else {
          appendPathsForBase(baseDir)
        }
      }
    } catch {
      // Ignorar erros de acesso
    }
  }

  return Array.from(candidatePaths).filter(p => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isFile()
    } catch {
      return false
    }
  })
}

/**
 * Busca recursiva por arquivos que podem ser logs do MTGA
 * Procura por arquivos .txt que contenham palavras-chave do MTGA
 */
export async function searchByContent(
  searchTerms: string[],
  maxDepth: number = 3,
  maxFileSize: number = 50 * 1024 * 1024 // 50MB
): Promise<LogSearchResult[]> {
  const results: LogSearchResult[] = []
  const homeDir = os.homedir()
  const searchDirs = [
    path.join(homeDir, 'AppData', 'LocalLow'),
    path.join(homeDir, 'AppData', 'Local'),
    path.join(homeDir, 'Documents'),
    path.join(homeDir, 'AppData', 'Roaming'),
    // Diretório do Steam MTGA
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\MTGA\\MTGA_Data\\Logs\\Logs',
  ]

  const keywords = searchTerms.map(term => term.toLowerCase())
  const mtgaKeywords = ['match', 'game', 'connecting', 'plains', 'island', 'defeat', 'lies']

  const searchInFile = (filePath: string): LogSearchResult | null => {
    try {
      const stats = fs.statSync(filePath)
      if (!stats.isFile() || stats.size > maxFileSize || stats.size === 0) {
        return null
      }

      // Ler apenas as primeiras 100KB para verificação rápida
      const sampleSize = Math.min(100 * 1024, stats.size)
      const buffer = Buffer.alloc(sampleSize)
      const fd = fs.openSync(filePath, 'r')
      fs.readSync(fd, buffer, 0, sampleSize, 0)
      fs.closeSync(fd)

      const content = buffer.toString('utf8', 0, sampleSize).toLowerCase()
      const matches: string[] = []
      let confidence = 0

      // Verificar palavras-chave do MTGA
      for (const keyword of mtgaKeywords) {
        if (content.includes(keyword)) {
          matches.push(keyword)
          confidence += 10
        }
      }

      // Verificar termos de busca específicos do usuário
      for (const term of keywords) {
        if (content.includes(term)) {
          matches.push(term)
          confidence += 15
        }
      }

      // Verificar padrões comuns do MTGA
      if (content.includes('output_log') || content.includes('mtga')) {
        confidence += 20
      }

      if (confidence > 0) {
        return {
          path: filePath,
          size: stats.size,
          lastModified: stats.mtime,
          confidence,
          matches: [...new Set(matches)],
        }
      }

      return null
    } catch {
      return null
    }
  }

  const searchInDirectory = (dirPath: string, depth: number): void => {
    if (depth > maxDepth) return

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        // Ignorar diretórios do sistema
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue
        }

        try {
          if (entry.isFile()) {
            // Verificar arquivos .txt, .log ou sem extensão
            const ext = path.extname(entry.name).toLowerCase()
            const name = entry.name.toLowerCase()
            if (
              ext === '.txt' ||
              ext === '.log' ||
              ext === '' ||
              name.includes('log') ||
              name.includes('utc_log')
            ) {
              const result = searchInFile(fullPath)
              if (result) {
                results.push(result)
              }
            }
          } else if (entry.isDirectory()) {
            // Buscar em diretórios relacionados ao MTGA ou Wizards
            const name = entry.name.toLowerCase()
            if (
              name.includes('mtga') ||
              name.includes('wizard') ||
              name.includes('magic') ||
              depth < 2
            ) {
              searchInDirectory(fullPath, depth + 1)
            }
          }
        } catch {
          // Ignorar erros de permissão
          continue
        }
      }
    } catch {
      // Ignorar erros de acesso
    }
  }

  for (const searchDir of searchDirs) {
    if (fs.existsSync(searchDir)) {
      searchInDirectory(searchDir, 0)
    }
  }

  // Ordenar por confiança (maior primeiro)
  return results.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Busca por logs do MTGA usando múltiplas estratégias
 */
export async function findMTGALogs(searchTerms: string[] = []): Promise<LogSearchResult[]> {
  const results: LogSearchResult[] = []

  // 1. Verificar locais comuns
  const commonPaths = searchCommonLocations()
  for (const logPath of commonPaths) {
    try {
      const stats = fs.statSync(logPath)
      results.push({
        path: logPath,
        size: stats.size,
        lastModified: stats.mtime,
        confidence: 100,
        matches: ['common_location'],
      })
    } catch {
      // Ignorar
    }
  }

  // 2. Buscar por conteúdo se termos foram fornecidos
  if (searchTerms.length > 0) {
    const contentResults = await searchByContent(searchTerms)
    results.push(...contentResults)
  }

  // Remover duplicatas e ordenar
  const uniqueResults = new Map<string, LogSearchResult>()
  for (const result of results) {
    const existing = uniqueResults.get(result.path)
    if (!existing || result.confidence > existing.confidence) {
      uniqueResults.set(result.path, result)
    }
  }

  return Array.from(uniqueResults.values()).sort((a, b) => b.confidence - a.confidence)
}

