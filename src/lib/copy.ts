// Ported verbatim from public/vatio-widget.js. The widget's own chrome. What
// the agent says is already in the visitor's language; these are the
// strings Vatio puts on the screen itself, and an English "Write a
// message..." under a Spanish conversation is exactly what makes a widget
// look bolted on.
export interface Copy {
  feedbackQuestion: string;
  feedbackGood: string;
  feedbackNeutral: string;
  feedbackBad: string;
  feedbackComment: string;
  feedbackThanks: string;
  feedbackSkip: string;
  feedbackError: string;
  lang: string;
  name: string;
  close: string;
  newChat: string;
  conversations: string;
  allChats: string;
  untitled: string;
  message: string;
  placeholder: string;
  send: string;
  stop: string;
  copyText: string;
  copied: string;
  latest: string;
  greeting: string;
  connecting: string;
  reconnecting: string;
  failed: string;
  cannotStart: string;
  notDelivered: string;
  retry: string;
  attach: string;
  removeFile: string;
  dropHere: string;
  dragHint: string;
  attachHint: string;
  dismiss: string;
  fileTooLarge: string;
  tooManyFiles: string;
  fileUnsupported: string;
}

export const COPY: Record<"en" | "es" | "pt", Copy> = {
  en: {
    feedbackQuestion: "How did {name} help you?", feedbackGood: "Good", feedbackNeutral: "So-so", feedbackBad: "Bad", feedbackComment: "What could we improve? (optional)", feedbackThanks: "Thanks for your feedback", feedbackSkip: "Skip", feedbackError: "Could not save. Please try again.",
    lang: "en", name: "Chat", close: "Close", newChat: "New conversation", conversations: "Conversations",
    allChats: "All conversations", untitled: "Conversation", message: "Message",
    placeholder: "Message…", send: "Send", stop: "Stop", copyText: "Copy", copied: "Copied", latest: "Jump to latest",
    greeting: "How can I help?", connecting: "Connecting…", reconnecting: "Reconnecting…", failed: "Something went wrong",
    cannotStart: "Could not start the chat", notDelivered: "Not delivered", retry: "Message not delivered — tap to retry",
    attach: "Attach a file", removeFile: "Remove", dropHere: "Drop to attach",
    dragHint: "You can drag photos, PDFs or audio here", attachHint: "You can attach photos, PDFs or audio", dismiss: "Dismiss",
    fileTooLarge: "Files can be up to 8 MB", tooManyFiles: "Up to 4 files per message",
    fileUnsupported: "That kind of file can't be sent — try a photo, a PDF, a text file or audio"
  },
  es: {
    feedbackQuestion: "¿Cómo te ayudó {name}?", feedbackGood: "Bien", feedbackNeutral: "Más o menos", feedbackBad: "Mal", feedbackComment: "¿Qué podríamos mejorar? (opcional)", feedbackThanks: "Gracias por contarnos", feedbackSkip: "Omitir", feedbackError: "No se pudo guardar. Inténtalo de nuevo.",
    lang: "es", name: "Chat", close: "Cerrar", newChat: "Nueva conversación", conversations: "Conversaciones",
    allChats: "Ver todas las conversaciones", untitled: "Conversación", message: "Mensaje",
    placeholder: "Escribe un mensaje…", send: "Enviar", stop: "Detener", copyText: "Copiar", copied: "Copiado", latest: "Ir al final",
    greeting: "¿En qué puedo ayudarte?", connecting: "Conectando…", reconnecting: "Reconectando…", failed: "Algo salió mal",
    cannotStart: "No se pudo iniciar el chat", notDelivered: "No se envió", retry: "El mensaje no se envió — toca para reintentar",
    attach: "Adjuntar un archivo", removeFile: "Quitar", dropHere: "Suelta para adjuntar",
    dragHint: "Puedes arrastrar fotos, PDFs o audios aquí", attachHint: "Puedes adjuntar fotos, PDFs o audios", dismiss: "Cerrar",
    fileTooLarge: "Los archivos pueden pesar hasta 8 MB", tooManyFiles: "Hasta 4 archivos por mensaje",
    fileUnsupported: "Ese tipo de archivo no se puede enviar — prueba con una foto, un PDF, un texto o un audio"
  },
  pt: {
    feedbackQuestion: "Como {name} ajudou você?", feedbackGood: "Bem", feedbackNeutral: "Mais ou menos", feedbackBad: "Mal", feedbackComment: "O que poderíamos melhorar? (opcional)", feedbackThanks: "Obrigado pelo feedback", feedbackSkip: "Pular", feedbackError: "Não foi possível salvar. Tente novamente.",
    lang: "pt", name: "Chat", close: "Fechar", newChat: "Nova conversa", conversations: "Conversas",
    allChats: "Ver todas as conversas", untitled: "Conversa", message: "Mensagem",
    placeholder: "Escreva uma mensagem…", send: "Enviar", stop: "Parar", copyText: "Copiar", copied: "Copiado", latest: "Ir para o final",
    greeting: "Como posso ajudar?", connecting: "Conectando…", reconnecting: "Reconectando…", failed: "Algo deu errado",
    cannotStart: "Não foi possível iniciar o chat", notDelivered: "Não enviado", retry: "A mensagem não foi enviada — toque para tentar de novo",
    attach: "Anexar um arquivo", removeFile: "Remover", dropHere: "Solte para anexar",
    dragHint: "Você pode arrastar fotos, PDFs ou áudios aqui", attachHint: "Você pode anexar fotos, PDFs ou áudios", dismiss: "Fechar",
    fileTooLarge: "Os arquivos podem ter até 8 MB", tooManyFiles: "Até 4 arquivos por mensagem",
    fileUnsupported: "Esse tipo de arquivo não pode ser enviado — tente uma foto, um PDF, um texto ou um áudio"
  }
};

// "es-CL", "pt_BR" and "ES" all name a language we have -- the region
// doesn't change the copy. The first argument that names one wins, so
// precedence is the caller's to decide; an unknown tag falls through to
// English rather than leaving a button with no label on it.
export function copyFor(...tags: Array<string | null | undefined>): Copy {
  for (const raw of tags) {
    const tag = String(raw || "").trim().toLowerCase().replace("_", "-").split("-")[0] as keyof typeof COPY;
    if (COPY[tag]) return COPY[tag];
  }
  return COPY.en;
}
