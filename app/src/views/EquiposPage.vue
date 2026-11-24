
<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Equipos</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/tabs/equipos/nuevo" aria-label="Nuevo equipo">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <ion-toolbar>
        <ion-searchbar
          v-model="q"
          :debounce="400"
          placeholder="Buscar por código o nombre"
          @ion-input="buscar"
        />
      </ion-toolbar>

      <ion-toolbar v-if="!conectado" color="warning">
        <ion-title size="small">
          Sin conexión: los datos pueden estar desactualizados
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Actualizar deslizando hacia abajo -->
      <ion-refresher slot="fixed" @ionRefresh="refrescar">
        <ion-refresher-content
          pulling-text="Desliza para actualizar"
          refreshing-text="Actualizando..."
        />
      </ion-refresher>

      <!-- Indicadores de carga inicial -->
      <ion-list v-if="cargando && equipos.length === 0">
        <ion-item v-for="n in 5" :key="n">
          <ion-label>
            <ion-skeleton-text animated style="width: 60%" />
            <ion-skeleton-text animated style="width: 40%" />
          </ion-label>
        </ion-item>
      </ion-list>

      <!-- Mensaje de error y reintento -->
      <div v-else-if="error" class="estado-vacio">
        <p>{{ error }}</p>
        <ion-button @click="cargar(true)">
          Reintentar
        </ion-button>
      </div>

      <!-- Estado vacío -->
      <div
        v-else-if="!cargando && equipos.length === 0"
        class="estado-vacio"
      >
        <ion-icon :icon="searchOutline" size="large" />
        <p>No se encontraron equipos.</p>
      </div>

      <!-- Listado de equipos -->
      <ion-list v-else>
        <ion-item-sliding
          v-for="equipo in equipos"
          :key="equipo.id"
        >
          <ion-item
            :router-link="`/tabs/equipos/${equipo.id}/editar`"
            button
          >
            <ion-label>
              <h2>{{ equipo.nombre }}</h2>
              <p>
                {{ equipo.codigo }} ·
                {{ equipo.categoria?.nombre ?? 'Sin categoría' }}
              </p>
            </ion-label>

            <ion-badge :color="colorEstado[equipo.estado]">
              {{ equipo.estado }}
            </ion-badge>
          </ion-item>

          <!-- Opciones de eliminación -->
          <ion-item-options side="end">
            <ion-item-option
              color="danger"
              @click="confirmarEliminacion(equipo, $event)"
            >
              <ion-icon slot="start" :icon="trashOutline" />
              Eliminar
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <!-- Cargar más resultados -->
      <ion-infinite-scroll
        :disabled="!hayMas || cargando || !!error"
        @ionInfinite="cargarMas"
      >
        <ion-infinite-scroll-content
          loading-text="Cargando más equipos..."
        />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonSearchbar,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonList,
  IonItem,
  IonLabel,
  IonSkeletonText,
  IonBadge,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  alertController,
  onIonViewWillEnter,
} from '@ionic/vue';

import type {
  InfiniteScrollCustomEvent,
  RefresherCustomEvent,
} from '@ionic/vue';

import {
  add,
  searchOutline,
  trashOutline,
} from 'ionicons/icons';

import {
  eliminar,
  listar,
  type Equipo,
  type Estado,
} from '@/services/equipos';

import { ErrorApi } from '@/services/errores';
import { mostrarToast } from '@/services/avisos';
import { useConexion, vibrar } from '@/composables/useConexion';

const colorEstado: Record<Estado, string> = {
  disponible: 'success',
  prestado: 'warning',
  mantenimiento: 'medium',
};

const { conectado } = useConexion();

const equipos = ref<Equipo[]>([]);
const pagina = ref(0);
const ultimaPagina = ref(1);
const q = ref('');

const cargando = ref(false);
const error = ref('');

const hayMas = computed(() => pagina.value < ultimaPagina.value);

/** Carga una página de equipos. */
async function cargar(reiniciar = false) {
  if (cargando.value) return;

  cargando.value = true;
  error.value = '';

  const paginaSolicitada = reiniciar ? 1 : pagina.value + 1;

  try {
    const respuesta = await listar(paginaSolicitada, q.value);

    if (reiniciar) {
      equipos.value = respuesta.data;
    } else {
      equipos.value = [...equipos.value, ...respuesta.data];
    }

    pagina.value = respuesta.meta.current_page;
    ultimaPagina.value = respuesta.meta.last_page;

  } catch (e) {
    error.value = e instanceof Error
      ? e.message
      : 'No fue posible cargar los equipos.';

  } finally {
    cargando.value = false;
  }
}

/** Recarga cada vez que se entra a la vista. */
onIonViewWillEnter(() => {
  void cargar(true);
});

/** Busca equipos desde la primera página. */
const buscar = () => cargar(true);

/** Actualiza la lista mediante el refresher. */
async function refrescar(evento: RefresherCustomEvent) {
  try {
    await cargar(true);
  } finally {
    evento.target.complete();
  }
}

/** Solicita la siguiente página. */
async function cargarMas(evento: InfiniteScrollCustomEvent) {
  try {
    if (hayMas.value) {
      await cargar(false);
    }
  } finally {
    evento.target.complete();
  }
}

/** Confirma y ejecuta la eliminación de un equipo. */
async function confirmarEliminacion(
  equipo: Equipo,
  evento: Event,
) {
  // Cerrar las opciones deslizables.
  const elemento = evento.target as HTMLElement;

  const sliding = elemento.closest('ion-item-sliding') as
    { close: () => Promise<void> } | null;

  await sliding?.close();

  // Solicitar confirmación.
  const alerta = await alertController.create({
    header: 'Eliminar equipo',
    message: `¿Deseas eliminar el equipo "${equipo.nombre}"?`,
    buttons: [
      {
        text: 'Cancelar',
        role: 'cancel',
      },
      {
        text: 'Eliminar',
        role: 'destructive',
      },
    ],
  });

  await alerta.present();

  const { role } = await alerta.onDidDismiss();

  if (role !== 'destructive') return;

  try {
    await eliminar(equipo.id);

    // 204: eliminación exitosa.
    equipos.value = equipos.value.filter(
      (item) => item.id !== equipo.id,
    );

    await vibrar();

    await mostrarToast(
      'Equipo eliminado correctamente.',
      'success',
    );

  } catch (e) {
    if (e instanceof ErrorApi) {

      // 409: no se puede eliminar porque está prestado.
      if (e.status === 409) {
        await mostrarToast(
          e.cuerpo?.mensaje ?? e.message,
          'warning',
        );
        return;
      }

      // 404: el equipo ya no existe en el servidor.
      if (e.status === 404) {
        equipos.value = equipos.value.filter(
          (item) => item.id !== equipo.id,
        );

        await mostrarToast(
          'El equipo ya no existe.',
          'medium',
        );
        return;
      }
    }

    await mostrarToast(
      e instanceof Error
        ? e.message
        : 'No fue posible eliminar el equipo.',
      'danger',
    );
  }
}
</script>
