import type { Timestamp, FieldValue } from 'firebase/firestore';

export type UserRole = 'owner' | 'partner' | 'admin' | 'superadmin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  acceptedDisclaimer?: boolean;
  acceptedAt?: Timestamp | FieldValue;
  createdAt: Timestamp | FieldValue;
}

export interface Pet {
  id?: string;
  userId: string;
  name: string;
  species: 'Perro' | 'Gato' | 'Ave' | 'Otro';
  breed?: string;
  birthDate?: string;
  age?: string;
  weight?: number;
  weightUnit?: string;
  condition?: string;
  ownerName: string;
  ownerPhone: string;
  createdAt: Timestamp | FieldValue;
}

export interface EmergencyProfile {
  userId: string;
  name: string;
  species: string;
  age: string;
  condition: string;
  ownerPhone: string;
  ownerName: string;
}

export type HealthEventType =
  | 'symptom'
  | 'medication'
  | 'vaccine'
  | 'vet_visit'
  | 'weight'
  | 'diet_change'
  | 'behavior';

export type Severity = 'low' | 'medium' | 'high';

export type ReminderType = 'vaccine' | 'medication' | 'vet_visit';

export interface Reminder {
  id?: string;
  type: ReminderType;
  description: string;
  scheduledDate: string | null;
  status: 'pending' | 'completed';
  createdAt: Timestamp | FieldValue;
  completedAt?: Timestamp | FieldValue;
}

export type GroomingType = 'bath' | 'haircut' | 'nails' | 'dental' | 'other';

export interface GroomingSession {
  id?: string;
  petId: string;
  userId: string;
  date: string;
  type: GroomingType;
  notes: string;
  provider?: string;
  cost?: number;
  source: 'manual' | 'whatsapp';
  createdAt: Timestamp | FieldValue;
}

export interface HealthEvent {
  id?: string;
  type: HealthEventType;
  description: string;
  severity?: Severity | null;
  date?: string | null;
  reportedAt: Timestamp | FieldValue;
  source: 'whatsapp' | 'manual';
  notes?: string;
}
