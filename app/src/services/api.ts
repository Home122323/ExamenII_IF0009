
import { ErrorApi } from './errores';
import { obtenerToken, olvidarSesion } from '@/composables/useAuth';
import router from '@/router';

const BASE_URL = import.meta.env.VITE_API_URL;
const TIEMPO_MAXIMO_MS = 10_000;

export interface OpcionesApi {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

export async function api<T = unknown>(
  ruta: string,
  opciones: OpcionesApi = {},
): Promise<T> {
  const { method = 'GET', body, params } = opciones;

  // Construir URL y agregar únicamente parámetros válidos.
  const url = new URL(`${BASE_URL}${ruta}`);

  if (params) {
    Object.entries(params).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== '') {
        url.searchParams.set(clave, String(valor));
      }
    });
  }

  // Encabezados obligatorios.
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const token = await obtenerToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const opcionesFetch: RequestInit = {
    method,
    headers,
  };

  // Enviar body únicamente cuando exista.
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opcionesFetch.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  opcionesFetch.signal = controller.signal;

  const temporizador = setTimeout(
    () => controller.abort(),
    TIEMPO_MAXIMO_MS,
  );

  try {
    const respuesta = await fetch(url.toString(), opcionesFetch);

    // Respuesta sin contenido.
    if (respuesta.status === 204) {
      return null as T;
    }

    // Intentar leer el cuerpo JSON.
    const cuerpoJson = await respuesta.json().catch(() => null);

    // Manejar errores HTTP.
    if (!respuesta.ok) {
      if (respuesta.status === 401 && ruta !== '/login') {
        await olvidarSesion();
        await router.replace('/login');
      }

      throw new ErrorApi(respuesta.status, cuerpoJson);
    }

    return cuerpoJson as T;

  } catch (error) {
    if (error instanceof ErrorApi) {
      throw error;
    }

    throw new ErrorApi(0, {
      mensaje: 'No fue posible conectar con la API.',
    });

  } finally {
    clearTimeout(temporizador);
  }
}
