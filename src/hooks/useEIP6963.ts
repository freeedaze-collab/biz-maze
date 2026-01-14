
import { useState, useSyncExternalStore } from 'react';

// Types for EIP-6963
interface EIP6963ProviderDetail {
    info: {
        uuid: string;
        name: string;
        icon: string;
        rdns: string;
    };
    provider: any;
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
    detail: EIP6963ProviderDetail;
}

declare global {
    interface WindowEventMap {
        'eip6963:announceProvider': EIP6963AnnounceProviderEvent;
    }
}

// Store logic
let providers: EIP6963ProviderDetail[] = [];
let listeners: Array<() => void> = [];

const emitChange = () => {
    listeners.forEach((listener) => listener());
};

const onAnnouncement = (event: EIP6963AnnounceProviderEvent) => {
    if (providers.some((p) => p.info.uuid === event.detail.info.uuid)) return;
    providers = [...providers, event.detail];
    emitChange();
};

window.addEventListener('eip6963:announceProvider', onAnnouncement);
window.dispatchEvent(new Event('eip6963:requestProvider'));

const subscribe = (listener: () => void) => {
    listeners = [...listeners, listener];
    return () => {
        listeners = listeners.filter((l) => l !== listener);
    };
};

const getSnapshot = () => providers;

export function useEIP6963() {
    const providers = useSyncExternalStore(subscribe, getSnapshot);
    return providers;
}
