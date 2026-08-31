import useWhatsApp from "../hooks/useWhatsApp";

function WhatsAppButton({ mensaje = "", className = "", children, onBeforeOpen }) {
  const { abrirWhatsApp } = useWhatsApp();

  const manejarClick = () => {
    if (onBeforeOpen?.() === false) return;
    abrirWhatsApp(mensaje);
  };

  return (
    <button type="button" onClick={manejarClick} className={className}>
      {children}
    </button>
  );
}

export default WhatsAppButton;
