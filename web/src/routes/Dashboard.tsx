import { usePetContext } from '../hooks/usePetContext';
import { QRCode } from '../components/QRCode';
import { Reminders } from '../components/Reminders';

export default function Dashboard() {
  const { pet, petId } = usePetContext();
  const name = pet.name || 'Tu mascota';
  const emergencyUrl = `https://pakumi-poc.web.app/emergency/${petId}`;

  return (
    <div className="space-y-6">
      {/* Pet info card */}
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {name}
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Nombre</dt>
            <dd className="text-gray-900 font-medium">{name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Especie</dt>
            <dd className="text-gray-900 font-medium">{pet.species || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Edad</dt>
            <dd className="text-gray-900 font-medium">{pet.age || '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Condiciones o alergias</dt>
            <dd className="text-gray-900 font-medium">
              {pet.condition || 'Sin condiciones registradas'}
            </dd>
          </div>
        </dl>
      </section>

      {/* Reminders */}
      <Reminders petId={petId} />

      {/* WhatsApp agent */}
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">
          Asistente Veterinario por WhatsApp
        </h3>
        <p className="text-gray-700 mb-4">
          Para hablar con el asistente veterinario de{' '}
          <span className="font-semibold">{name}</span>, envía un mensaje
          al siguiente número:
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Número de WhatsApp
          </p>
          <p className="text-2xl font-bold text-gray-900 tracking-wide">
            +1 (415) 523-8886
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-900">
            Primero debes enviar el mensaje:{' '}
            <code className="bg-yellow-100 px-2 py-0.5 rounded font-mono text-yellow-900">
              join suddenly-shelter
            </code>{' '}
            para activar el canal.
          </p>
        </div>

        <p className="text-gray-700 text-sm">
          Una vez activado, puedes escribir cualquier consulta sobre la salud de{' '}
          <span className="font-semibold">{name}</span> y nuestro
          asistente con IA te responderá.
        </p>
      </section>

      {/* Emergency QR */}
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">
          QR de Emergencia
        </h3>
        <p className="text-gray-700 mb-5">
          Imprime este código QR y colócalo en el collar de{' '}
          <span className="font-semibold">{name}</span>. Cualquier persona
          que lo escanee podrá ver su información de emergencia.
        </p>
        <QRCode url={emergencyUrl} petName={name} />
      </section>
    </div>
  );
}
