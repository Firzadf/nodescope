import { setRequestGapMs } from '../../shared/requestPace.mjs';

// The suite mocks RPC. Production keeps the 250 ms gap. Tests opt out
// so a health check does not sleep between every fake response.
setRequestGapMs(0);
