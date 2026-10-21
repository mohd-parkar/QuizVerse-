import { useEffect, useState } from 'react';
import { api } from './api.js';

// GET `path` on mount (and whenever it changes). `loading` is derived, so a new path never flashes stale data.
export function useApi(path) {
  const [state, setState] = useState({ path: null, data: null, error: null });

  useEffect(() => {
    let live = true;
    api
      .get(path)
      .then((data) => live && setState({ path, data, error: null }))
      .catch((error) => live && setState({ path, data: null, error }));
    return () => {
      live = false;
    };
  }, [path]);

  const ready = state.path === path;
  return { data: ready ? state.data : null, error: ready ? state.error : null, loading: !ready };
}
