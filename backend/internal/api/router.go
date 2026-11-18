package api

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// NewRouter builds the HTTP handler. staticDir "" disables static/SPA serving.
func NewRouter(logger *slog.Logger, staticDir string) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer, requestLogger(logger))

	if staticDir != "" {
		r.NotFound(spaHandler(staticDir))
	} else {
		r.NotFound(notFound)
	}
	r.MethodNotAllowed(func(w http.ResponseWriter, _ *http.Request) { writeError(w, errMethodNotAllowed) })

	r.Get("/healthz", healthz)
	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/evaluate", evaluate)
		r.Post("/operations/{name}", operation)
	})
	return r
}

func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			logger.Info("request",
				"method", r.Method, "path", r.URL.Path, "status", ww.Status(),
				"duration_ms", time.Since(start).Milliseconds())
		})
	}
}
