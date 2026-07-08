import React, { useEffect, useMemo, useState } from "react";
import atlasAdmin, { type AtlasRefreshMode } from "../../api/atlasAdmin";

const clamp = (value: number, fallback: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const AtlasAdminPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AtlasRefreshMode>("pr");
  const [ref, setRef] = useState("main");
  const [maxSeries, setMaxSeries] = useState("500");
  const [requestDelay, setRequestDelay] = useState("800");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [status, setStatus] = useState<{ tone: "idle" | "success" | "error"; message: string }>({ tone: "idle", message: "" });

  const helpText = useMemo(
    () => mode === "pr"
      ? "Creates a reviewable pull request before deploy."
      : "Commits Atlas data directly to the target branch so Vercel redeploys immediately.",
    [mode],
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    setAuthLoading(true);
    atlasAdmin
      .getSession()
      .then((response) => {
        if (!active) return;
        setAuthenticated(response.authenticated);
      })
      .catch((error) => {
        if (!active) return;
        setStatus({
          tone: "error",
          message: error instanceof Error ? error.message : "Unable to inspect Atlas admin session.",
        });
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus({ tone: "idle", message: "" });
    try {
      const response = await atlasAdmin.login(password);
      setAuthenticated(response.authenticated);
      setPassword("");
      setStatus({ tone: "success", message: response.message || "Atlas admin session started." });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Atlas admin login failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async () => {
    setIsSubmitting(true);
    setStatus({ tone: "idle", message: "" });
    try {
      const response = await atlasAdmin.logout();
      setAuthenticated(false);
      setStatus({ tone: "success", message: response.message || "Atlas admin session cleared." });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Atlas admin logout failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus({ tone: "idle", message: "" });
    try {
      const response = await atlasAdmin.triggerRefresh({
        mode,
        ref: ref.trim() || "main",
        maxSeries: clamp(Number.parseInt(maxSeries, 10), 500, 25, 5000),
        requestDelay: clamp(Number.parseInt(requestDelay, 10), 800, 200, 5000),
      });
      setStatus({ tone: "success", message: response.message });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Atlas refresh trigger failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`atlas-admin ${open ? "is-open" : ""}`}>
      <button type="button" className="atlas-admin-launcher" onClick={() => setOpen((value) => !value)}>
        Atlas Refresh
      </button>
      {open && (
        <div className="atlas-admin-panel">
          <div className="atlas-admin-header">
            <div>
              <h3>Atlas Refresh</h3>
              <p>Protected admin trigger for phases 2 and 3.</p>
            </div>
            <button type="button" className="close-btn" aria-label="Close Atlas admin panel" onClick={() => setOpen(false)}>
              &times;
            </button>
          </div>
          {authLoading ? (
            <p className="atlas-admin-hint">Checking admin session...</p>
          ) : authenticated ? (
            <>
              <div className="atlas-admin-session-row">
                <p className="atlas-admin-hint">Signed in with a secure server-side session.</p>
                <button type="button" className="atlas-admin-secondary" onClick={logout} disabled={isSubmitting}>
                  Sign out
                </button>
              </div>
              <form onSubmit={submit} className="atlas-admin-form">
                <label className="atlas-admin-field">
                  <span>Mode</span>
                  <select value={mode} onChange={(event) => setMode(event.target.value as AtlasRefreshMode)}>
                    <option value="pr">PR review</option>
                    <option value="direct">Direct deploy</option>
                  </select>
                </label>
                <p className="atlas-admin-hint">{helpText}</p>
                <label className="atlas-admin-field">
                  <span>Branch</span>
                  <input type="text" value={ref} onChange={(event) => setRef(event.target.value)} placeholder="main" />
                </label>
                <div className="atlas-admin-grid">
                  <label className="atlas-admin-field">
                    <span>Max series</span>
                    <input type="number" min={25} max={5000} step={25} value={maxSeries} onChange={(event) => setMaxSeries(event.target.value)} />
                  </label>
                  <label className="atlas-admin-field">
                    <span>Delay ms</span>
                    <input type="number" min={200} max={5000} step={50} value={requestDelay} onChange={(event) => setRequestDelay(event.target.value)} />
                  </label>
                </div>
                <button type="submit" className="atlas-admin-submit" disabled={isSubmitting}>
                  {isSubmitting ? "Dispatching..." : mode === "pr" ? "Create Atlas PR" : "Run Direct Refresh"}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={login} className="atlas-admin-form">
              <label className="atlas-admin-field">
                <span>Admin password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Server-side ATLAS_ADMIN_PASSWORD"
                  required
                />
              </label>
              <p className="atlas-admin-hint">Signs in by setting an `HttpOnly` same-site admin session cookie.</p>
              <button type="submit" className="atlas-admin-submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
          )}
          {status.message && <p className={`atlas-admin-status atlas-admin-status--${status.tone}`}>{status.message}</p>}
        </div>
      )}
    </div>
  );
};

export default AtlasAdminPanel;
