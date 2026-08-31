import { useContext } from "react";
import WhatsAppContext from "../context/whatsappContextBase";

export default function useWhatsApp() {
  const contexto = useContext(WhatsAppContext);
  if (!contexto) throw new Error("useWhatsApp debe usarse dentro de WhatsAppProvider.");
  return contexto;
}
