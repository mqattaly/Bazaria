import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ROLE_CODES,
  ROLE_LABELS_FA,
  type CompanyEntitlementView,
  type MembershipView,
  type RoleCode,
} from '@bazaria/shared';
import { useSession } from '../session/SessionContext';
import { Layout } from '../components/Layout';
import { Alert, Badge, Button, Card, Spinner, Value } from '../components/ui';
import { SubscriptionNotice } from '../components/SubscriptionNotice';
import { api, ApiError, type CompanyView } from '../lib/api';
import { formatJalaliDate, formatJalaliDateTime } from '../lib/date';
import {
  currencyLabel,
  roleLabel,
  subscriptionStateLabel,
  toPersianDigits,
} from '../lib/text';

export function CompanyPage(): JSX.Element {
  const { activeCompany, user, clearActiveCompany, refreshCompanies, refresh } = useSession();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<ApiError | null>(null);
  const [company, setCompany] = useState<CompanyView | null>(null);
  const [license, setLicense] = useState<CompanyEntitlementView | null>(null);
  const [members, setMembers] = useState<MembershipView[] | null>(null);

  const [nameDraft, setNameDraft] = useState('');
  const [currencyDraft, setCurrencyDraft] = useState('IRR');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<ApiError | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [memberError, setMemberError] = useState<ApiError | null>(null);
  const [memberBusy, setMemberBusy] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    mobile: '',
    fullName: '',
    role: 'sales_representative' as RoleCode,
  });
  const [adding, setAdding] = useState(false);
  const [tokenNotice, setTokenNotice] = useState<{
    token: string;
    title: string;
    expiresAt?: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setAccessError(null);
    try {
      const view = await api.company(activeCompany.id);
      setCompany(view);
      setNameDraft(view.name);
      setCurrencyDraft(view.currency);

      if (view.permissions.includes('license.view')) {
        setLicense(await api.license(activeCompany.id));
      } else {
        setLicense(null);
      }

      if (view.permissions.includes('membership.view')) {
        setMembers(await api.memberships(activeCompany.id));
      } else {
        setMembers(null);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          await refresh();
          return;
        }
        setAccessError(err);
      } else {
        setAccessError(
          new ApiError({
            status: 0,
            code: 'NETWORK_ERROR',
            message: 'دریافت اطلاعات شرکت ناموفق بود.',
          }),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [activeCompany, refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reloadMembers(): Promise<void> {
    if (!activeCompany) return;
    setMembers(await api.memberships(activeCompany.id));
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeCompany) return;
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSaved(false);
    try {
      const updated = await api.updateCompany(activeCompany.id, {
        name: nameDraft,
        currency: currencyDraft,
      });
      setCompany(updated);
      setSettingsSaved(true);
      await refreshCompanies();
    } catch (err) {
      setSettingsError(
        err instanceof ApiError
          ? err
          : new ApiError({
              status: 0,
              code: 'NETWORK_ERROR',
              message: 'ذخیره اطلاعات شرکت انجام نشد.',
            }),
      );
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeCompany) return;
    setAdding(true);
    setMemberError(null);
    try {
      const result = await api.addMembership(activeCompany.id, addForm);
      setAddForm({ mobile: '', fullName: '', role: 'sales_representative' });
      if (result.inviteToken) {
        setTokenNotice({
          token: result.inviteToken,
          title: `کد فعال‌سازی برای ${result.membership.fullName}`,
          expiresAt: result.inviteExpiresAt,
        });
      }
      await reloadMembers();
    } catch (err) {
      setMemberError(
        err instanceof ApiError
          ? err
          : new ApiError({
              status: 0,
              code: 'NETWORK_ERROR',
              message: 'افزودن عضو انجام نشد.',
            }),
      );
    } finally {
      setAdding(false);
    }
  }

  async function changeRole(member: MembershipView, role: RoleCode): Promise<void> {
    if (!activeCompany) return;
    setMemberBusy(member.id);
    setMemberError(null);
    try {
      await api.updateMembership(activeCompany.id, member.id, { role });
      await reloadMembers();
    } catch (err) {
      setMemberError(err instanceof ApiError ? err : null);
    } finally {
      setMemberBusy(null);
    }
  }

  async function toggleStatus(member: MembershipView): Promise<void> {
    if (!activeCompany) return;
    setMemberBusy(member.id);
    setMemberError(null);
    try {
      await api.updateMembership(activeCompany.id, member.id, {
        status: member.status === 'active' ? 'inactive' : 'active',
      });
      await reloadMembers();
    } catch (err) {
      setMemberError(err instanceof ApiError ? err : null);
    } finally {
      setMemberBusy(null);
    }
  }

  async function resetPassword(member: MembershipView): Promise<void> {
    if (!activeCompany) return;
    setMemberBusy(member.id);
    setMemberError(null);
    try {
      const result = await api.resetMembershipPassword(activeCompany.id, member.id);
      setTokenNotice({
        token: result.token,
        title: `کد بازنشانی رمز برای ${member.fullName}`,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      setMemberError(err instanceof ApiError ? err : null);
    } finally {
      setMemberBusy(null);
    }
  }

  function switchCompany(): void {
    clearActiveCompany();
    navigate('/companies');
  }

  if (loading) {
    return (
      <Layout>
        <Spinner />
      </Layout>
    );
  }

  if (accessError) {
    return (
      <Layout>
        <Card title="دسترسی به این شرکت ممکن نیست">
          <Alert requestId={accessError.requestId}>
            <p>{accessError.message}</p>
            {accessError.code === 'LICENSE_INACTIVE' ? (
              <p className="mt-2 text-xs">
                مجوز شرکت غیرفعال است یا مهلت آن پایان یافته است. داده‌ها حذف نمی‌شوند و
                پس از فعال‌سازی مجوز دوباره در دسترس خواهند بود.
              </p>
            ) : null}
          </Alert>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={switchCompany}>انتخاب شرکت دیگر</Button>
            <Button variant="secondary" onClick={() => void load()}>
              تلاش دوباره
            </Button>
          </div>
        </Card>
      </Layout>
    );
  }

  if (!company) return <Layout>{null}</Layout>;

  const canManageSettings = company.permissions.includes('company.settings.manage');
  const canViewMembers = company.permissions.includes('membership.view');
  const canManageMembers = company.permissions.includes('membership.manage');
  // Writes are enforced by the API; the UI mirrors the same state so no write
  // control looks available while the company is read-only.
  const readOnly = !company.subscription.writeAllowed;

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{company.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            کد شرکت: <span dir="ltr">{company.code}</span> · نقش شما: {roleLabel(company.role)}
          </p>
        </div>
        <Badge tone={company.status === 'active' ? 'success' : 'warning'}>
          {company.status === 'active' ? 'شرکت فعال' : 'شرکت غیرفعال'}
        </Badge>
      </div>

      <SubscriptionNotice subscription={company.subscription} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="اطلاعات پایه شرکت">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">نام</dt>
              <Value>{company.name}</Value>
            </div>
            <div>
              <dt className="text-xs text-slate-500">کد شرکت</dt>
              <Value>
                <span dir="ltr">{company.code}</span>
              </Value>
            </div>
            <div>
              <dt className="text-xs text-slate-500">واحد پول</dt>
              <Value>
                {currencyLabel(company.currency)}{' '}
                <span className="text-xs text-slate-400" dir="ltr">
                  ({company.currency})
                </span>
              </Value>
            </div>
          </dl>

          {canManageSettings ? (
            <form
              onSubmit={(event) => void saveSettings(event)}
              className="mt-5 space-y-3 border-t border-slate-100 pt-4"
            >
              <p className="text-xs text-slate-500">
                تغییر نام و واحد پول ثبت و ممیزی می‌شود. پس از ثبت اسناد مالی، تغییر واحد
                پول محدودیت بیشتری خواهد داشت.
              </p>
              {readOnly ? (
                <Alert tone="warning">
                  اشتراک شرکت در حالت فقط‌خواندنی است؛ ویرایش اطلاعات شرکت تا تمدید
                  اشتراک ممکن نیست.
                </Alert>
              ) : null}
              {settingsError ? (
                <Alert requestId={settingsError.requestId}>{settingsError.message}</Alert>
              ) : null}
              {settingsSaved ? <Alert tone="success">اطلاعات شرکت ذخیره شد.</Alert> : null}

              <div>
                <label htmlFor="company-name">نام شرکت</label>
                <input
                  id="company-name"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  minLength={2}
                  maxLength={160}
                  required
                  disabled={readOnly || savingSettings}
                />
              </div>
              <div>
                <label htmlFor="company-currency">واحد پول</label>
                <select
                  id="company-currency"
                  value={currencyDraft}
                  onChange={(event) => setCurrencyDraft(event.target.value)}
                  disabled={readOnly || savingSettings}
                >
                  <option value="IRR">ریال (IRR)</option>
                  <option value="IRT">تومان (IRT)</option>
                </select>
              </div>
              <Button type="submit" loading={savingSettings} disabled={readOnly}>
                ذخیره تغییرات
              </Button>
            </form>
          ) : (
            <p className="mt-5 text-xs text-slate-400">
              ویرایش اطلاعات شرکت فقط با مجوز مدیریت تنظیمات شرکت ممکن است.
            </p>
          )}
        </Card>

        <Card
          title="مجوز و اشتراک شرکت"
          description="وضعیت اشتراک از تاریخ اعتبار و تنظیم مهلت ارفاقی سرور محاسبه می‌شود."
        >
          {license ? (
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-slate-500">وضعیت مجوز</dt>
                <dd>
                  <Badge tone={license.status === 'active' ? 'success' : 'warning'}>
                    {license.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-slate-500">وضعیت اشتراک</dt>
                <dd>
                  <Badge
                    tone={
                      license.subscription.state === 'active'
                        ? 'success'
                        : license.subscription.state === 'grace_period'
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {subscriptionStateLabel(license.subscription.state)}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">سقف فروشگاه</dt>
                <Value>
                  {toPersianDigits(company.storeUsage.active)} از{' '}
                  {toPersianDigits(license.maxStores)} فروشگاه فعال
                </Value>
              </div>
              <div>
                <dt className="text-xs text-slate-500">اعتبار تا</dt>
                <Value>
                  {license.validUntil ? formatJalaliDate(license.validUntil) : 'بدون تاریخ انقضا'}
                </Value>
              </div>
              {license.subscription.graceEndsAt ? (
                <div>
                  <dt className="text-xs text-slate-500">پایان مهلت ارفاقی</dt>
                  <Value>{formatJalaliDateTime(license.subscription.graceEndsAt)}</Value>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-slate-500">مدت مهلت ارفاقی</dt>
                <Value>{toPersianDigits(license.subscription.gracePeriodDays)} روز</Value>
              </div>
              <div>
                <dt className="text-xs text-slate-500">آخرین به‌روزرسانی</dt>
                <Value>{formatJalaliDateTime(license.updatedAt)}</Value>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">
              نمایش سقف‌های مجوز برای نقش شما مجاز نیست.
            </p>
          )}
        </Card>
      </div>

      {tokenNotice ? (
        <div className="mt-4">
          <Card title={tokenNotice.title}>
            <Alert tone="warning">
              این کد فقط یک‌بار نمایش داده می‌شود. آن را به‌صورت امن به کاربر برسانید؛
              سامانه آن را ذخیره نمی‌کند.
            </Alert>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code
                dir="ltr"
                className="max-w-full overflow-x-auto rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-800"
              >
                {tokenNotice.token}
              </code>
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(tokenNotice.token);
                }}
              >
                کپی
              </Button>
              <Button variant="ghost" onClick={() => setTokenNotice(null)}>
                بستن
              </Button>
            </div>
            {tokenNotice.expiresAt ? (
              <p className="mt-2 text-xs text-slate-500">
                اعتبار تا: {formatJalaliDateTime(tokenNotice.expiresAt)}
              </p>
            ) : null}
          </Card>
        </div>
      ) : null}

      {canViewMembers && members ? (
        <div className="mt-4">
          <Card title="اعضای شرکت" description="نقش هر عضو فقط در همین شرکت اعمال می‌شود.">
            {memberError ? (
              <Alert requestId={memberError.requestId}>
                <p>{memberError.message}</p>
              </Alert>
            ) : null}

            {readOnly ? (
              <div className="mt-4">
                <Alert tone="warning">
                  در حالت فقط‌خواندنی، افزودن یا تغییر نقش اعضا ممکن نیست. بازنشانی
                  رمز اعضا برای حفظ امنیت حساب‌ها فعال مانده است.
                </Alert>
              </div>
            ) : null}

            {canManageMembers ? (
              <form
                onSubmit={(event) => void handleAddMember(event)}
                className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4"
              >
                <div>
                  <label htmlFor="member-mobile">شماره موبایل</label>
                  <input
                    id="member-mobile"
                    dir="ltr"
                    className="text-start"
                    value={addForm.mobile}
                    onChange={(event) =>
                      setAddForm({ ...addForm, mobile: event.target.value })
                    }
                    placeholder="09121234567"
                    required
                    disabled={readOnly || adding}
                  />
                </div>
                <div>
                  <label htmlFor="member-name">نام و نام خانوادگی</label>
                  <input
                    id="member-name"
                    value={addForm.fullName}
                    onChange={(event) =>
                      setAddForm({ ...addForm, fullName: event.target.value })
                    }
                    minLength={2}
                    required
                    disabled={readOnly || adding}
                  />
                </div>
                <div>
                  <label htmlFor="member-role">نقش</label>
                  <select
                    id="member-role"
                    value={addForm.role}
                    onChange={(event) =>
                      setAddForm({ ...addForm, role: event.target.value as RoleCode })
                    }
                    disabled={readOnly || adding}
                  >
                    {ROLE_CODES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS_FA[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full" loading={adding} disabled={readOnly}>
                    افزودن عضو
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="mt-4 overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>نام</th>
                    <th>موبایل</th>
                    <th>نقش</th>
                    <th>وضعیت</th>
                    {canManageMembers ? <th>عملیات</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const isSelf = member.userId === user?.id;
                    const busy = memberBusy === member.id;
                    return (
                      <tr key={member.id}>
                        <td>
                          <span className="font-medium text-slate-800">{member.fullName}</span>
                          {isSelf ? (
                            <span className="ms-2 text-xs text-slate-400">(شما)</span>
                          ) : null}
                        </td>
                        <td dir="ltr" className="text-start text-xs text-slate-600">
                          {member.mobile}
                        </td>
                        <td>
                          {canManageMembers && !isSelf ? (
                            <select
                              aria-label={`نقش ${member.fullName}`}
                              value={member.role}
                              disabled={busy || readOnly}
                              onChange={(event) =>
                                void changeRole(member, event.target.value as RoleCode)
                              }
                              className="mt-0 py-1 text-xs"
                            >
                              {ROLE_CODES.map((role) => (
                                <option key={role} value={role}>
                                  {ROLE_LABELS_FA[role]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm">{roleLabel(member.role)}</span>
                          )}
                        </td>
                        <td>
                          <Badge tone={member.status === 'active' ? 'success' : 'warning'}>
                            {member.status === 'active' ? 'فعال' : 'غیرفعال'}
                          </Badge>
                        </td>
                        {canManageMembers ? (
                          <td>
                            <div className="flex flex-wrap gap-1">
                              <Button
                                variant={member.status === 'active' ? 'danger' : 'secondary'}
                                className="px-2 py-1 text-xs"
                                disabled={isSelf || busy || readOnly}
                                onClick={() => void toggleStatus(member)}
                                title={
                                  isSelf
                                    ? 'تغییر وضعیت عضویت خودتان مجاز نیست'
                                    : undefined
                                }
                              >
                                {member.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                              </Button>
                              <Button
                                variant="ghost"
                                className="px-2 py-1 text-xs"
                                disabled={busy}
                                onClick={() => void resetPassword(member)}
                              >
                                کد بازنشانی رمز
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              غیرفعال‌سازی کاربر یا عضویت، دسترسی را در درخواست بعدی قطع می‌کند. تغییر نقش
              بلافاصله در همان نشست اعمال می‌شود.
            </p>
          </Card>
        </div>
      ) : null}
    </Layout>
  );
}
