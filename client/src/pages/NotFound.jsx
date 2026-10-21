import { Link } from 'react-router-dom';
import { Button } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div className="bg-glow flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-7xl font-extrabold text-accent">404</p>
      <h1 className="mt-4 text-xl font-semibold">That page doesn’t exist</h1>
      <p className="mt-1 text-muted">The link may be old, or mistyped.</p>
      <Link to="/"><Button className="mt-6">Back home</Button></Link>
    </div>
  );
}
