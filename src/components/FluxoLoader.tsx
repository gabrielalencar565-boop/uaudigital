import { useEffect, useRef } from 'react';
import './fluxo-loader.js';

/**
 * Tela de carregamento do Fluxo para React (Vite/Next/CRA).
 *
 *   const [loading, setLoading] = useState(true);
 *   ...
 *   <FluxoLoader loading={loading} />
 *
 * Enquanto `loading` for true a animação fica rodando (liga / desliga).
 * Quando virar false, ela termina a animação do logo e some com fade.
 */

type Theme = 'dark' | 'light';

interface FluxoLoaderHandle {
  element: HTMLDivElement;
  hide: () => Promise<void>;
  destroy: () => Promise<void>;
}

interface FluxoLoaderOptions {
  theme?: Theme;
  size?: number;
  minLoops?: number;
  zIndex?: number;
  label?: string;
}

declare global {
  interface Window {
    FluxoLoader: { show: (opts?: FluxoLoaderOptions) => FluxoLoaderHandle };
  }
}

export interface FluxoLoaderProps {
  /** true = mostrando; false = termina a animação e esconde */
  loading: boolean;
  /** 'dark' (padrão) ou 'light' */
  theme?: Theme;
  /** largura máxima do logo em px (padrão 420) */
  size?: number;
  /** quantas vezes o logo precisa acender antes de poder fechar (padrão 1) */
  minLoops?: number;
  /** chamado depois que a tela sumiu */
  onHidden?: () => void;
}

export function FluxoLoader({ loading, theme = 'dark', size = 420, minLoops = 1, onHidden }: FluxoLoaderProps) {
  const handle = useRef<FluxoLoaderHandle | null>(null);

  useEffect(() => {
    handle.current = window.FluxoLoader.show({ theme, size, minLoops });
    return () => {
      handle.current?.destroy();
      handle.current = null;
    };
    // abre uma vez por montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && handle.current) {
      handle.current.hide().then(() => onHidden?.());
    }
  }, [loading, onHidden]);

  return null;
}

export default FluxoLoader;
