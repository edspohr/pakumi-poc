import { useOutletContext } from 'react-router-dom';
import type { Pet } from '../types';

interface PetContext {
  pet: Pet;
  petId: string;
}

export function usePetContext(): PetContext {
  return useOutletContext<PetContext>();
}
