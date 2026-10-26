// Regression tests for the live native-leg timeout (independent QA, 26 Oct
// 2026): getApi built `new WsProvider(url, false)` but never called
// provider.connect(), so ApiPromise.create hung until the 10s timeout on
// every run even though the raw WSS endpoint was healthy. The mock below
// mirrors real behavior: ApiPromise.create only settles once the provider
// has connected, so removing the connect() call fails these tests instead
// of passing silently.
import { describe, it, expect, vi } from 'vitest';
import { WsProvider, ApiPromise } from '@polkadot/api';
import { getApi } from './native';

type MockProvider = {
  url: string;
  autoConnect: boolean;
  connected: boolean;
  connectCalls: number;
  disconnectCalls: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

vi.mock('@polkadot/api', () => {
  class MockWsProvider {
    static instances: MockWsProvider[] = [];
    url: string;
    autoConnect: boolean;
    connected = false;
    connectCalls = 0;
    disconnectCalls = 0;
    constructor(url: string, autoConnect: boolean) {
      this.url = url;
      this.autoConnect = autoConnect;
      MockWsProvider.instances.push(this);
    }
    async connect(): Promise<void> {
      this.connectCalls += 1;
      this.connected = true;
    }
    async disconnect(): Promise<void> {
      this.disconnectCalls += 1;
      this.connected = false;
    }
  }
  return {
    WsProvider: MockWsProvider,
    ApiPromise: {
      create: vi.fn(async ({ provider }: { provider: MockWsProvider }) => {
        if (!provider.connected) return new Promise(() => {});
        return { __mockApi: true };
      }),
    },
  };
});

// The mocked module's runtime class (the real type declarations do not
// carry the mock's static instances list, hence the cast).
const MockedWsProvider = WsProvider as unknown as {
  instances: MockProvider[];
  new (url: string, autoConnect: boolean): MockProvider;
};

const createMock = ApiPromise.create as unknown as (opts: {
  provider: MockProvider;
}) => Promise<unknown>;

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

describe('getApi provider connection', () => {
  it('calls provider.connect() with autoConnect still false, then resolves', async () => {
    // getApi memoises per URL, so each test uses its own URL instead of
    // resetting modules; the new provider is the one created by this call.
    const before = MockedWsProvider.instances.length;
    const api = await getApi('wss://example.invalid/connect', 500);
    expect(api).toEqual({ __mockApi: true });
    const created = MockedWsProvider.instances.slice(before);
    expect(created).toHaveLength(1);
    const [provider] = created;
    expect(provider.url).toBe('wss://example.invalid/connect');
    expect(provider.autoConnect).toBe(false);
    expect(provider.connectCalls).toBe(1);
  });

  it('mirrors real behavior: create without connect never settles', async () => {
    const provider = new MockedWsProvider('wss://example.invalid/unconnected', false);
    const race = await Promise.race([
      createMock({ provider }).then(() => 'resolved'),
      delay('pending', 50),
    ]);
    // Under the old bug (no connect() call) this is exactly what
    // ApiPromise.create did: hang until the caller's timeout fired.
    expect(race).toBe('pending');
    await provider.connect();
    await expect(createMock({ provider })).resolves.toEqual({ __mockApi: true });
  });
});
