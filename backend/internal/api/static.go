package api

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// spaHandler serves an existing file under dir, else index.html. /api/ paths always get the JSON 404.
func spaHandler(dir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			notFound(w, r)
			return
		}
		f := filepath.Join(dir, filepath.FromSlash(path.Clean("/"+r.URL.Path)))
		if st, err := os.Stat(f); err != nil || st.IsDir() {
			f = filepath.Join(dir, "index.html")
		}
		http.ServeFile(w, r, f)
	}
}
