import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePetContext } from '../hooks/usePetContext';
import { deletePet } from '../lib/firestore';
import { PetForm } from '../components/PetForm';

export default function Settings() {
  const { pet, petId } = usePetContext();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const name = pet.name || 'Tu mascota';

  async function handleDelete() {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar a ${name}? Esta acción no se puede deshacer y borrará su perfil de emergencia público.`)) {
      return;
    }
    
    setDeleting(true);
    try {
      await deletePet(petId);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Error deleting pet:', err);
      alert('Hubo un error al eliminar la mascota.');
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">
        Configuración de {name}
      </h2>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium">
          {successMsg}
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Editar Perfil</h3>
        <PetForm
          key={pet.id}
          initialData={pet}
          onSuccess={() => {
            setSuccessMsg('¡Cambios guardados correctamente!');
            setTimeout(() => setSuccessMsg(''), 5000);
          }}
        />
      </div>

      <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6 mt-8">
        <h3 className="text-lg font-bold text-red-600 mb-2">Zona de Peligro</h3>
        <p className="text-gray-600 text-sm mb-4">
          Al eliminar a {name}, su perfil médico y su código QR de emergencia dejarán de funcionar permanentemente.
        </p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-medium rounded-lg px-4 py-2 transition disabled:opacity-50"
        >
          {deleting ? 'Eliminando...' : `Eliminar a ${name}`}
        </button>
      </div>
    </div>
  );
}
