import { useState } from 'react';

interface DisclaimerProps {
  onAccept: () => Promise<void>;
  /** Read-only mode — hides the accept button (for re-reading the policy). */
  readOnly?: boolean;
  onClose?: () => void;
}

export function Disclaimer({ onAccept, readOnly, onClose }: DisclaimerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAccept() {
    setError('');
    setLoading(true);
    try {
      await onAccept();
    } catch (err) {
      console.error(err);
      setError('No se pudo registrar tu aceptación. Intenta de nuevo.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Protección de Datos Personales
          </h2>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-4 overflow-y-auto text-sm text-gray-700 space-y-4 flex-1">
          <p>
            Al utilizar la plataforma <strong>Pakumi</strong>, usted acepta las
            siguientes condiciones sobre el tratamiento de sus datos personales:
          </p>

          <h3 className="font-semibold text-gray-900">1. Datos recopilados</h3>
          <p>
            Pakumi recopila información de salud de su mascota (nombre, especie,
            raza, edad, peso, condiciones médicas) y datos de contacto del
            propietario (nombre, número de WhatsApp, correo electrónico) con el
            fin exclusivo de prestar los servicios de la plataforma.
          </p>

          <h3 className="font-semibold text-gray-900">2. Almacenamiento y seguridad</h3>
          <p>
            Los datos son almacenados de forma segura en infraestructura de nube
            provista por Google Cloud (Firebase). Se aplican medidas de seguridad
            técnicas y organizativas para proteger su información contra acceso no
            autorizado, pérdida o alteración.
          </p>

          <h3 className="font-semibold text-gray-900">3. Uso de los datos</h3>
          <p>
            Sus datos se utilizan exclusivamente para:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Proveer el servicio de asistente veterinario con inteligencia artificial por WhatsApp.</li>
            <li>Generar y mostrar el perfil de emergencia asociado al código QR de su mascota.</li>
            <li>Facilitar el contacto entre quien encuentre a su mascota y usted como propietario.</li>
          </ul>
          <p>
            Pakumi no comparte, vende ni transfiere sus datos personales a
            terceros con fines comerciales o publicitarios.
          </p>

          <h3 className="font-semibold text-gray-900">4. Derechos del titular</h3>
          <p>
            De acuerdo con la Ley N° 29733 — Ley de Protección de Datos Personales
            del Perú y su Reglamento (Decreto Supremo N° 003-2013-JUS), usted
            tiene derecho a acceder, rectificar, cancelar u oponerse al
            tratamiento de sus datos personales en cualquier momento. Para ejercer
            estos derechos, puede contactarnos a través de los canales indicados en
            la plataforma.
          </p>

          <h3 className="font-semibold text-gray-900">5. Eliminación de datos</h3>
          <p>
            Usted puede solicitar la eliminación completa de sus datos y los de su
            mascota en cualquier momento. La solicitud será procesada en un plazo
            máximo de diez (10) días hábiles.
          </p>

          <h3 className="font-semibold text-gray-900">6. Limitación del asistente con IA</h3>
          <p>
            El asistente veterinario con inteligencia artificial proporciona
            orientación general sobre la salud de su mascota.{' '}
            <strong>
              No constituye un diagnóstico médico veterinario ni reemplaza la
              consulta con un médico veterinario colegiado.
            </strong>{' '}
            El propietario es el único responsable de las decisiones médicas
            relativas a su mascota y debe consultar con un profesional veterinario
            habilitado ante cualquier emergencia o situación que requiera atención
            clínica.
          </p>

          <h3 className="font-semibold text-gray-900">7. Consentimiento</h3>
          <p>
            Al hacer clic en «Acepto», usted otorga su consentimiento libre,
            expreso e informado para el tratamiento de sus datos personales
            conforme a las condiciones descritas en este documento.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {readOnly ? (
            <button
              onClick={onClose}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg py-3 transition"
            >
              Cerrar
            </button>
          ) : (
            <button
              onClick={handleAccept}
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-hover text-white font-medium rounded-lg py-3 transition disabled:opacity-60"
            >
              {loading ? 'Registrando...' : 'Acepto'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
