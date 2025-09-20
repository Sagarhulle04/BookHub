import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

const ReadBook = () => {
  const { id } = useParams()
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [viewerWidth, setViewerWidth] = useState(800)
  const [viewerHeight, setViewerHeight] = useState(0)
  const viewerRef = useRef(null)
  const wheelContainerRef = useRef(null)
  const wheelAccumRef = useRef(0)
  const wheelRafRef = useRef(null)

  useEffect(() => {
    const updateSize = () => {
      if (viewerRef.current) {
        const rect = viewerRef.current.getBoundingClientRect()
        const isMobile = window.innerWidth < 768
        setViewerWidth(Math.min(Math.max(320, Math.floor(rect.width - (isMobile ? 24 : 0))), 1200))
        // On mobile, constrain by height so it doesn't clip; on desktop, let width drive size for better readability
        setViewerHeight(isMobile ? Math.floor(window.innerHeight * 0.8) : 0)
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages)
  }

  // Attach non-passive wheel listener to control page turning without warnings
  useEffect(() => {
    const el = wheelContainerRef.current
    if (!el) return
    const handler = (e) => {
      e.preventDefault()
      wheelAccumRef.current += e.deltaY
      const threshold = 60
      if (wheelRafRef.current) cancelAnimationFrame(wheelRafRef.current)
      wheelRafRef.current = requestAnimationFrame(() => {
        if (wheelAccumRef.current > threshold) {
          setPageNumber((p) => Math.min((numPages || p), p + 1))
          wheelAccumRef.current = 0
        } else if (wheelAccumRef.current < -threshold) {
          setPageNumber((p) => Math.max(1, p - 1))
          wheelAccumRef.current = 0
        }
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => {
      el.removeEventListener('wheel', handler)
    }
  }, [numPages])

  if (!id) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-600">Page {pageNumber} of {numPages || '?'}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="px-3 py-1 bg-white border border-gray-300 rounded disabled:opacity-50"
            >Prev</button>
            <button
              onClick={() => setPageNumber((p) => Math.min(numPages || p, p + 1))}
              disabled={!numPages || pageNumber >= numPages}
              className="px-3 py-1 bg-white border border-gray-300 rounded disabled:opacity-50"
            >Next</button>
          </div>
        </div>
        <div ref={viewerRef} className="border bg-white rounded-none md:rounded-lg">
          <Document
            file={`/api/books/${id}/pdf`}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="h-96 flex items-center justify-center">Loading PDF...</div>}
            error={<div className="h-96 flex items-center justify-center text-gray-700">PDF Access Issue</div>}
          >
            <div
              ref={wheelContainerRef}
              className="h-[80vh] md:h-[85vh] overflow-auto"
            >
              <div className="w-full h-full flex items-center justify-center py-4 px-3 md:px-0">
                <Page
                  pageNumber={pageNumber}
                  height={viewerHeight || undefined}
                  width={!viewerHeight ? Math.min(viewerWidth, 1000) : undefined}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </div>
              {numPages && pageNumber < numPages ? (
                <div className="hidden">
                  <Page pageNumber={pageNumber + 1} width={viewerWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                </div>
              ) : null}
              {numPages && pageNumber > 1 ? (
                <div className="hidden">
                  <Page pageNumber={pageNumber - 1} width={viewerWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                </div>
              ) : null}
            </div>
          </Document>
        </div>
      </div>
    </div>
  )
}

export default ReadBook


