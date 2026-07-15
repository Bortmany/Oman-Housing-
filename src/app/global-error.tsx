"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import "./globals.css";

// Last-resort boundary: catches errors in the root layout itself, so it runs
// OUTSIDE the locale/i18n provider and must render its own <html>/<body>.
// That means plain English here (no translations available at this level).
// Kept left-to-right and centered so it looks fine regardless of locale.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // When Sentry is configured it captures this automatically.
    console.error(error);
  }, [error]);

  return (
    <html lang="en" dir="ltr">
      <body className="antialiased">
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            color: "#1c1917",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#57534e", maxWidth: "28rem" }}>
            Sorry, the app ran into a problem. Please try again, or come back in
            a moment.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              marginTop: "0.5rem",
              borderRadius: "0.5rem",
              backgroundColor: "#115e59",
              color: "#ffffff",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
