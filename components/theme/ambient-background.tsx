export function AmbientBackground() {
  return (
    <div className="ambient-background" aria-hidden="true">
      <div className="ambient-background__wash" />

      <div className="ambient-lamp ambient-lamp--left">
        <div className="ambient-lamp__spill" />
        <div className="ambient-lamp__cone" />
        <div className="ambient-lamp__core" />
      </div>

      <div className="ambient-lamp ambient-lamp--right">
        <div className="ambient-lamp__spill" />
        <div className="ambient-lamp__cone" />
        <div className="ambient-lamp__core" />
      </div>

      <div className="ambient-background__vignette" />
      <div className="ambient-background__grain" />
    </div>
  );
}
