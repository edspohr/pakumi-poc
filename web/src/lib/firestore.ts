import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  writeBatch,
  collection,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { where, updateDoc } from 'firebase/firestore';
import type { Pet, EmergencyProfile, UserProfile, HealthEvent, Reminder, GroomingSession } from '../types';

// ── User profiles ──────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName?: string,
): Promise<UserProfile> {
  const existing = await getUserProfile(uid);
  if (existing) return existing;

  const profile: UserProfile = {
    uid,
    email,
    displayName: displayName || undefined,
    role: 'owner',
    createdAt: serverTimestamp(),
  };
  // Use merge: true so a late-firing ensureUserProfile call never clobbers
  // fields written by other codepaths (e.g. acceptedDisclaimer from the
  // disclaimer modal, which may have resolved first under StrictMode double-
  // mount). The initial fields here are only the base identity; they should
  // be set if absent but must not overwrite anything else.
  await setDoc(doc(db, 'users', uid), profile, { merge: true });
  return profile;
}

export async function acceptDisclaimer(uid: string): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    { acceptedDisclaimer: true, acceptedAt: serverTimestamp() },
    { merge: true },
  );
}

// ── Pets ───────────────────────────────────────────────────────────

export async function getUserPets(uid: string): Promise<Pet[]> {
  const q = query(
    collection(db, 'pets'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Pet);
}

export async function getPet(petId: string): Promise<Pet | null> {
  const snap = await getDoc(doc(db, 'pets', petId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Pet;
}

export async function getEmergencyProfile(petId: string): Promise<EmergencyProfile | null> {
  const snap = await getDoc(doc(db, 'emergency_profiles', petId));
  if (!snap.exists()) return null;
  return snap.data() as EmergencyProfile;
}

export async function registerPet(
  petData: Omit<Pet, 'id' | 'createdAt'>,
): Promise<string> {
  const petRef = doc(db, 'pets', crypto.randomUUID());
  const petId = petRef.id;

  const emergencyDoc: EmergencyProfile = {
    userId: petData.userId,
    name: petData.name,
    species: petData.species,
    age: petData.age || '',
    condition: petData.condition || '',
    ownerPhone: petData.ownerPhone,
    ownerName: petData.ownerName,
  };

  const batch = writeBatch(db);
  batch.set(petRef, { ...petData, createdAt: serverTimestamp() });
  batch.set(doc(db, 'emergency_profiles', petId), emergencyDoc);
  await batch.commit();

  return petId;
}

export async function deletePet(petId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'pets', petId));
  batch.delete(doc(db, 'emergency_profiles', petId));
  await batch.commit();
}

export async function updatePet(
  petId: string,
  petData: Partial<Pet>
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'pets', petId), { ...petData, updatedAt: serverTimestamp() });
  
  const emergencyUpdate: Partial<EmergencyProfile> = {};
  if (petData.userId !== undefined) emergencyUpdate.userId = petData.userId;
  if (petData.name !== undefined) emergencyUpdate.name = petData.name;
  if (petData.species !== undefined) emergencyUpdate.species = petData.species;
  if (petData.age !== undefined) emergencyUpdate.age = petData.age;
  if (petData.condition !== undefined) emergencyUpdate.condition = petData.condition;
  if (petData.ownerPhone !== undefined) emergencyUpdate.ownerPhone = petData.ownerPhone;
  if (petData.ownerName !== undefined) emergencyUpdate.ownerName = petData.ownerName;

  if (Object.keys(emergencyUpdate).length > 0) {
    batch.update(doc(db, 'emergency_profiles', petId), emergencyUpdate);
  }
  
  await batch.commit();
}


// ── Health events ──────────────────────────────────────────────────

export async function getHealthEvents(petId: string): Promise<HealthEvent[]> {
  const q = query(
    collection(db, 'health_events', petId, 'events'),
    orderBy('reportedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HealthEvent);
}

// ── Reminders ──────────────────────────────────────────────────────

export async function getPendingReminders(petId: string): Promise<Reminder[]> {
  const q = query(
    collection(db, 'reminders', petId, 'pending'),
    where('status', '==', 'pending'),
    orderBy('scheduledDate'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reminder);
}

export async function completeReminder(petId: string, reminderId: string): Promise<void> {
  await updateDoc(doc(db, 'reminders', petId, 'pending', reminderId), {
    status: 'completed',
    completedAt: serverTimestamp(),
  });
}

// ── Health events (manual) ─────────────────────────────────────────

export async function addHealthEvent(
  petId: string,
  event: Omit<HealthEvent, 'id' | 'reportedAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'health_events', petId, 'events'), {
    ...event,
    reportedAt: serverTimestamp(),
  });
  return ref.id;
}

// ── Grooming ──────────────────────────────────────────────────────

export async function getGroomingSessions(petId: string): Promise<GroomingSession[]> {
  const q = query(
    collection(db, 'grooming_records', petId, 'sessions'),
    orderBy('date', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GroomingSession);
}

export async function addGroomingSession(
  petId: string,
  session: Omit<GroomingSession, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'grooming_records', petId, 'sessions'), {
    ...session,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
