import { useState, useCallback } from 'react'
import type { LogSearchResult } from '../types/global'

type LogFinderProps = {
  onSelect: (path: string) => Promise<void>
  onClose: () => void
}

export default function LogFinder({ onSelect, onClose }: LogFinderProps) {
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<LogSearchResult[]>([])
  const [searchTerms, setSearchTerms] = useState('')
  const [selecting, setSelecting] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!window.mtga) return

    setSearching(true)
    try {
      const terms = searchTerms
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)
      
      const found = await window.mtga.searchLogs(terms)
      setResults(found)
    } catch (error) {
      console.error('Error searching logs:', error)
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [searchTerms])

  const handleSelectFile = useCallback(async () => {
    if (!window.mtga) return

    setSelecting(true)
    try {
      const selected = await window.mtga.selectLogFile()
      if (selected) {
        await onSelect(selected)
        onClose()
      }
    } catch (error) {
      console.error('Error selecting file:', error)
    } finally {
      setSelecting(false)
    }
  }, [onSelect, onClose])

  const handleSelectResult = useCallback(
    async (path: string) => {
      await onSelect(path)
      onClose()
    },
    [onSelect, onClose]
  )

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('pt-BR')
  }

  return (
    <div className="log-finder-overlay" onClick={onClose}>
      <div className="log-finder-modal" onClick={(e) => e.stopPropagation()}>
        <div className="log-finder-header">
          <h2>Encontrar arquivo de log do MTGA</h2>
          <button onClick={onClose} className="close-button">
            ×
          </button>
        </div>

        <div className="log-finder-content">
          <div className="log-finder-section">
            <h3>Buscar automaticamente</h3>
            <p style={{ fontSize: '0.9em', opacity: 0.8, marginBottom: '1em' }}>
              Digite termos para buscar (nomes de cartas, "Match", "Game", "Connecting", etc.):
            </p>
            <div style={{ display: 'flex', gap: '0.5em', marginBottom: '1em' }}>
              <input
                type="text"
                value={searchTerms}
                onChange={(e) => setSearchTerms(e.target.value)}
                placeholder='Ex: Plains, Island, Match, Game, Connecting'
                style={{ flex: 1, padding: '0.5em' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch()
                }}
              />
              <button onClick={handleSearch} disabled={searching}>
                {searching ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>

          <div className="log-finder-section">
            <h3>Ou selecionar manualmente</h3>
            <button onClick={handleSelectFile} disabled={selecting} style={{ width: '100%' }}>
              {selecting ? 'Abrindo...' : 'Selecionar arquivo...'}
            </button>
          </div>

          {results.length > 0 && (
            <div className="log-finder-section">
              <h3>Resultados encontrados ({results.length})</h3>
              <div className="log-finder-results">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className="log-finder-result"
                    onClick={() => handleSelectResult(result.path)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.25em' }}>
                          {result.path}
                        </div>
                        <div style={{ fontSize: '0.85em', opacity: 0.7 }}>
                          {formatSize(result.size)} • Modificado: {formatDate(result.lastModified)}
                        </div>
                        {result.matches.length > 0 && (
                          <div style={{ fontSize: '0.8em', marginTop: '0.5em' }}>
                            <span style={{ opacity: 0.6 }}>Correspondências: </span>
                            {result.matches.join(', ')}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          marginLeft: '1em',
                          padding: '0.25em 0.5em',
                          background: result.confidence >= 50 ? '#4caf50' : '#ff9800',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '0.85em',
                          fontWeight: 'bold',
                        }}
                      >
                        {result.confidence}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

