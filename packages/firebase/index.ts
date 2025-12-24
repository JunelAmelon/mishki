import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signOut,
  signInWithPopup,
  updateProfile,
  User,
} from "firebase/auth"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { auth, db } from "./client"
export { collection, doc, doc as fsDoc, getDoc, getDocs, addDoc, query, where } from "firebase/firestore"

export type SignupB2CInput = {
  email: string
  password: string
  firstName?: string
  lastName?: string
  phone?: string
  address?: string
  postalCode?: string
  city?: string
}

export type SignupB2BInput = {
  email: string
  password: string
  company?: string
  siret?: string
  contactName?: string
  phone?: string
  firstName?: string
  lastName?: string
  address?: string
  postalCode?: string
  city?: string
  activityType?: string
  kbisUrl?: string
  idUrl?: string
}

export async function login(email: string, password: string): Promise<User> {
  const { user } = await signInWithEmailAndPassword(auth, email, password)
  return user
}

// Auth Google (B2C) - crée/merge le profil en base
export async function loginWithGoogleB2C(): Promise<User> {
  const provider = new GoogleAuthProvider()
  const { user } = await signInWithPopup(auth, provider)

  const names = user.displayName?.split(" ") ?? []
  const firstName = names.slice(0, -1).join(" ") || null
  const lastName = names.slice(-1).join(" ") || null

  await setDoc(
    doc(db, "users", user.uid),
    {
      email: user.email,
      role: "b2c",
      firstName,
      lastName,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  )

  return user
}

export async function logout(): Promise<void> {
  await signOut(auth)
}

export async function signupB2C(payload: SignupB2CInput): Promise<User> {
  const { email, password, firstName, lastName, phone, address, postalCode, city } = payload
  const { user } = await createUserWithEmailAndPassword(auth, email, password)

  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim()
  if (displayName) {
    await updateProfile(user, { displayName })
  }

  await setDoc(doc(db, "users", user.uid), {
    email,
    role: "b2c",
    firstName: firstName ?? null,
    lastName: lastName ?? null,
    phone: phone ?? null,
    address: address ?? null,
    postalCode: postalCode ?? null,
    city: city ?? null,
    createdAt: serverTimestamp(),
  })

  return user
}

export async function signupB2B(payload: SignupB2BInput): Promise<User> {
  const {
    email,
    password,
    company,
    siret,
    contactName,
    phone,
    firstName,
    lastName,
    address,
    postalCode,
    city,
    activityType,
    kbisUrl,
    idUrl,
  } = payload
  const { user } = await createUserWithEmailAndPassword(auth, email, password)

  const contact =
    contactName ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    null

  const displayName = contact || company || ""
  if (displayName) {
    await updateProfile(user, { displayName })
  }

  await setDoc(doc(db, "users", user.uid), {
    email,
    role: "b2b",
    company: company ?? null,
    siret: siret ?? null,
    contactName: contact,
    firstName: firstName ?? null,
    lastName: lastName ?? null,
    phone: phone ?? null,
    address: address ?? null,
    postalCode: postalCode ?? null,
    city: city ?? null,
    activityType: activityType ?? null,
    kbisUrl: kbisUrl ?? null,
    idUrl: idUrl ?? null,
    validated: false,
    createdAt: serverTimestamp(),
  })

  return user
}

export * from "./client"
