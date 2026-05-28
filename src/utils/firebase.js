// Firebase 초기화 및 Firestore 헬퍼
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteField, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD-RVnR3HbEioQ1kBkQOXSIohkyKzBpWHE',
  authDomain: 'etc-dashboard-4937f.firebaseapp.com',
  projectId: 'etc-dashboard-4937f',
  storageBucket: 'etc-dashboard-4937f.firebasestorage.app',
  messagingSenderId: '786943054418',
  appId: '1:786943054418:web:c0aa9990f20d5dc382c58b',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 컬렉션: dashboards, 문서ID: hospital110 | hospital2nd
const COLLECTION = 'dashboards';

/** Firestore에서 대시보드 데이터 불러오기. 없으면 null. */
export async function loadDashboard(taskId) {
  try {
    const ref = doc(db, COLLECTION, taskId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
  } catch (e) {
    console.error(`[firebase] loadDashboard(${taskId}) 실패:`, e);
    return null;
  }
}

/** Firestore에 대시보드 전체 데이터 저장 (덮어쓰기). */
export async function saveDashboard(taskId, data) {
  try {
    const ref = doc(db, COLLECTION, taskId);
    await setDoc(ref, data);
    return true;
  } catch (e) {
    console.error(`[firebase] saveDashboard(${taskId}) 실패:`, e);
    throw e;
  }
}
