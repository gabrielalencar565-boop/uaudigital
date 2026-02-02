import React from "react";

type Props = {
  children: React.ReactNode;
  resetKey?: string;
};

type State = { hasError: boolean; error?: unknown };

class Boundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("App crashed (ErrorBoundary):", error);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.resetKey && prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-svh bg-background text-foreground">
        <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center px-6 py-10">
          <h1 className="text-balance text-2xl font-semibold tracking-tight">Algo saiu do trilho</h1>
          <p className="mt-2 text-muted-foreground">
            O painel encontrou um erro inesperado. Se você estiver com extensões de tradução ativas, isso pode acontecer.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
            <a
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium"
              href="/auth"
            >
              Voltar para login
            </a>
          </div>
        </main>
      </div>
    );
  }
}

export function AppErrorBoundary({ children, resetKey }: Props) {
  return <Boundary resetKey={resetKey}>{children}</Boundary>;
}
