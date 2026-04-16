import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getUserPets } from '../lib/firestore';
import type { Pet } from '../types';

const SPECIES_ICON: Record<string, string> = {
  Perro: '🐕',
  Gato: '🐈',
  Ave: '🐦',
  Otro: '🐾',
};

interface PetSelectorProps {
  currentPetId: string;
}

export function PetSelector({ currentPetId }: PetSelectorProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pets, setPets] = useState<Pet[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserPets(user.uid)
      .then(setPets)
      .catch((err) => console.error('[PetSelector] fetch error:', err));
  }, [user]);

  if (pets.length <= 1) {
    const pet = pets[0];
    if (!pet) return null;
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <span>{SPECIES_ICON[pet.species] || '🐾'}</span>
        <span className="text-sm font-semibold text-gray-900 truncate">{pet.name}</span>
      </div>
    );
  }

  const current = pets.find((p) => p.id === currentPetId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition w-full"
      >
        <span>{current ? SPECIES_ICON[current.species] || '🐾' : '🐾'}</span>
        <span className="text-sm font-semibold text-gray-900 truncate flex-1 text-left">
          {current?.name || 'Seleccionar mascota'}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
          {pets.map((pet) => (
            <button
              key={pet.id}
              onClick={() => {
                setOpen(false);
                if (pet.id !== currentPetId) {
                  navigate(`/pet/${pet.id}`);
                }
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition ${
                pet.id === currentPetId ? 'bg-green-50 text-brand font-semibold' : 'text-gray-700'
              }`}
            >
              <span>{SPECIES_ICON[pet.species] || '🐾'}</span>
              <span className="truncate">{pet.name}</span>
            </button>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/register');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-brand hover:bg-green-50 transition font-medium"
            >
              <span>+</span>
              <span>Registrar otra mascota</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
