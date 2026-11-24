
import { computed, ref } from 'vue';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Device } from '@capacitor/device';
import { api } from '@/services/api';

export interface Usuario {
  id: number;
  nombre: string;
}

const CLAVE_TOKEN = 'token';
const CLAVE_USUARIO = 'usuario';

const token = ref<string | null>(null);
const usuario = ref<Usuario | null>(null);
let tokenCargado = false;

export const obtenerToken = () => token.value;

/** Borra la sesión de memoria y del almacenamiento seguro. */
export async function olvidarSesion() {
  token.value = null;
  usuario.value = null;

  await Promise.all([
    SecureStorage.remove(CLAVE_TOKEN),
    SecureStorage.remove(CLAVE_USUARIO),
  ]);
}

export function useAuth() {
  const estaAutenticado = computed(() => token.value !== null);

  /** Inicia sesión y almacena las credenciales de forma segura. */
  async function login(email: string, password: string) {
    const dispositivo = await Device.getInfo();

    const device_name =
      `${dispositivo.platform} ${dispositivo.model}`.slice(0, 60);

    const respuesta = await api<{
      token: string;
      usuario: Usuario;
    }>('/login', {
      method: 'POST',
      body: {
        email,
        password,
        device_name,
      },
    });

    await SecureStorage.set(CLAVE_TOKEN, respuesta.token);
    await SecureStorage.set(
      CLAVE_USUARIO,
      JSON.stringify(respuesta.usuario),
    );

    token.value = respuesta.token;
    usuario.value = respuesta.usuario;
  }

  /** Recupera la sesión guardada una sola vez. */
  async function cargarToken() {
    if (tokenCargado) return;

    tokenCargado = true;

    const tokenGuardado = await SecureStorage.get(CLAVE_TOKEN);
    const usuarioGuardado = await SecureStorage.get(CLAVE_USUARIO);

    if (typeof tokenGuardado === 'string' && tokenGuardado.length > 0) {
      token.value = tokenGuardado;
    }

    if (typeof usuarioGuardado === 'string') {
      try {
        usuario.value = JSON.parse(usuarioGuardado) as Usuario;
      } catch {
        usuario.value = null;
      }
    }
  }

  /** Revoca la sesión en el servidor y siempre limpia la sesión local. */
  async function cerrarSesion() {
    try {
      await api('/logout', {
        method: 'POST',
      });
    } finally {
      await olvidarSesion();
    }
  }

  return {
    usuario,
    estaAutenticado,
    login,
    cargarToken,
    cerrarSesion,
  };
}
