import { useEffect, useState } from 'react';

interface PortSummary {
  readonly path: string;
  readonly chipsetName: string;
}

export function App(): JSX.Element {
  const [ports, setPorts] = useState<readonly PortSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.radioApi
      .listSerialPorts()
      .then((result: readonly PortSummary[]) => setPorts(result))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Multi-Radio Programmer</h1>
      <h2>Detected serial ports</h2>
      {error !== null && <p role="alert">{error}</p>}
      {ports.length === 0 ? (
        <p>No programming cable detected. Connect a cable and restart.</p>
      ) : (
        <ul>
          {ports.map((port) => (
            <li key={port.path}>
              <strong>{port.path}</strong> — {port.chipsetName}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
