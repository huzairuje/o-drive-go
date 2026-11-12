package webui

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed dist/*
var distFS embed.FS

// Handler serves static files from the embedded Next.js export out directory.
// If a file is not found (e.g. client-side route), it falls back to index.html (SPA).
func Handler() http.Handler {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte("<h1>Omni-Drive Go</h1><p>Embedded UI loading...</p>"))
		})
	}

	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		// Try opening the exact requested file
		f, err := sub.Open(path)
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// Check if directory index.html exists (e.g. "login/index.html" for "login" or "login/")
		trimmed := strings.TrimSuffix(path, "/")
		if fDir, err := sub.Open(trimmed + "/index.html"); err == nil {
			fDir.Close()
			r.URL.Path = "/" + trimmed + "/"
			fileServer.ServeHTTP(w, r)
			return
		}

		// Check if path.html exists (Next.js static export fallback)
		if fHtml, err := sub.Open(trimmed + ".html"); err == nil {
			fHtml.Close()
			r.URL.Path = "/" + trimmed + ".html"
			fileServer.ServeHTTP(w, r)
			return
		}

		// Fallback to index.html for SPA routing
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
