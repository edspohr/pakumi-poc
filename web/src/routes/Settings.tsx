import { usePetContext } from '../hooks/usePetContext';

export default function Settings() {
  const { pet } = usePetContext();
  const name = pet.name || 'Tu mascota';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">
        Configuración de {name}
      </h2>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
        <p className="text-4xl mb-3">⚙️</p>
        <p className="text-gray-500">
          La edición de perfil de mascota y configuración de cuenta estará disponible próximamente.
        </p>
      </div>
    </div>
  );
}
