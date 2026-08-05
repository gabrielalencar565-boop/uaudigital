import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

const ALLOWED_HOST = "uaudigital.lovable.app";

export function RedirectNotice() {
  const [isVisible, setIsVisible] = useState(false);
  const newUrl = "https://uaudigital.vercel.app/";

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsVisible(window.location.hostname === ALLOWED_HOST);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#181818] px-6 text-center">
      <div className="max-w-xl rounded-2xl border border-[#6b21a8]/30 bg-[#232323] p-8 shadow-2xl sm:p-10">
        <div className="mb-6 text-4xl">🚀</div>

        <h1 className="mb-4 text-2xl font-bold text-white sm:text-3xl">
          O SISTEMA DA UAU MUDOU!
        </h1>

        <p className="mb-6 text-base text-gray-300 sm:text-lg">
          A partir de agora, o nosso sistema interno está em um novo endereço.
        </p>

        <a
          href={newUrl}
          target="_self"
          rel="noopener noreferrer"
          className="mb-6 inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#6d28d9] sm:text-lg"
        >
          Acesse pelo novo link
          <ExternalLink className="h-5 w-5" />
        </a>

        <p className="text-sm font-medium text-[#7c3aed] break-all sm:text-base">
          {newUrl}
        </p>

        <div className="mt-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
          ⚠️ Importante: atualize o endereço salvo nos seus favoritos e utilize
          somente este link para acessar o sistema daqui pra frente.
        </div>
      </div>
    </div>
  );
}

