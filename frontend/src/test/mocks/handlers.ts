import { http, HttpResponse } from 'msw';

/**
 * MSW Handlers for Firebase Callable Functions.
 * Firebase Callable SDK sends POST requests and expects { result: ... } in response.
 */

const REGION = 'us-central1';
const PROJECT_ID = 'letusmeet-6f4e1';
const BASE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

export const handlers = [
  // createPoll
  http.post('*/createPoll', async ({ request }) => {
    const { data } = (await request.json()) as any;
    console.log('MSW: Intercepted createPoll', data);
    return HttpResponse.json({
      result: {
        pollId: 'mock-poll-id-123',
      },
    });
  }),

  // getPoll
  http.post('*/getPoll', async ({ request }) => {
    const { data } = (await request.json()) as any;
    console.log('MSW: Intercepted getPoll', data);
    return HttpResponse.json({
      result: {
        poll: {
          pollId: data.pollId || 'mock-poll-id-123',
          organizerUid: 'user123',
          title: 'Mock Meeting',
          location: 'Virtual',
          description: 'Testing 123',
          status: 'OPEN',
          createdAt: new Date().toISOString(),
          timeSlots: [
            { id: 't1', startTime: '2026-10-10T10:00:00Z', endTime: '2026-10-10T11:00:00Z' },
            { id: 't2', startTime: '2026-10-10T14:00:00Z', endTime: '2026-10-10T15:00:00Z' },
          ],
        },
        votes: [],
        voteCounts: {
          t1: { YES: 0, NO: 0, IF_NEED_BE: 0 },
          t2: { YES: 0, NO: 0, IF_NEED_BE: 0 },
        },
      },
    });
  }),

  // submitVote
  http.post('*/submitVote', async ({ request }) => {
    const { data } = (await request.json()) as any;
    console.log('MSW: Intercepted submitVote', data);
    return HttpResponse.json({
      result: {
        success: true,
      },
    });
  }),
];
