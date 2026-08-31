import { crearUrlWhatsApp } from "../config/whatsapp";

function WhatsAppButton({ mensaje = "", className = "", children, onBeforeOpen }) {
  const manejarClick = (event) => {
    if (onBeforeOpen?.() === false) event.preventDefault();
  };

  return (
    <a
      href={crearUrlWhatsApp(mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={manejarClick}
      className={className}
    >
      {children}
    </a>
  );
}

export default WhatsAppButton;
