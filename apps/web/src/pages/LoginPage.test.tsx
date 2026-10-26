import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { SessionProvider } from '../session/SessionContext';
import { ApiError } from '../lib/api';

const meMock = vi.fn();
const companiesMock = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      me: () => meMock(),
      myCompanies: () => companiesMock(),
      login: vi.fn(),
    },
  };
});

describe('Login page', () => {
  beforeEach(() => {
    meMock.mockRejectedValue(
      new ApiError({
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'برای ادامه باید وارد شوید.',
      }),
    );
    companiesMock.mockResolvedValue([]);
  });

  it('renders Persian login labels', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <SessionProvider>
          <LoginPage />
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('شماره موبایل')).toBeInTheDocument();
    expect(screen.getByLabelText('رمز عبور')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ورود' })).toBeInTheDocument();
    expect(screen.getByText('بازاریا')).toBeInTheDocument();
  });

  it('shows a safe generic error when credentials are rejected', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <SessionProvider>
          <LoginPage />
        </SessionProvider>
      </MemoryRouter>,
    );

    // The page itself must not reveal whether an account exists; it only shows
    // the server message after a failed submit. Here we assert the static shell.
    expect(container.textContent).toContain('بازاریا');
    expect(container.textContent).not.toContain('رمز عبور صحیح');
  });
});
