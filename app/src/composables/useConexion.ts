
import { ref, onUnmounted } from 'vue';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export function useConexion() {
  const conectado = ref(true);
  const tipo = ref('unknown');

  let listener: { remove: () => Promise<void> } | undefined;

  async function iniciar() {
    // Consultar el estado actual de la conexión.
    const estado = await Network.getStatus();

    conectado.value = estado.connected;
    tipo.value = estado.connectionType;

    // Escuchar cambios posteriores de conexión.
    listener = await Network.addListener(
      'networkStatusChange',
      (nuevoEstado) => {
        conectado.value = nuevoEstado.connected;
        tipo.value = nuevoEstado.connectionType;
      },
    );
  }

  void iniciar();

  // Liberar el listener cuando se destruye la vista.
  onUnmounted(() => {
    void listener?.remove();
  });

  return { conectado, tipo };
}

export async function vibrar() {
  // La vibración solo funciona en plataformas nativas.
  if (!Capacitor.isNativePlatform()) return;

  await Haptics.impact({ style: ImpactStyle.Light });
}
