import { useTranslation } from 'react-i18next';
import CustomerToggleForm from '../components/CustomerToggleForm';

/**
 * CustomerManagement
 *
 * Route: /customers
 *
 * Page-level wrapper that hosts the CustomerToggleForm component.
 * Intentionally thin — future additions (customer list, search results table,
 * arrears dashboard) will be composed here as sibling components.
 *
 * `onSuccess` is wired up here so this page can later refresh a customer list
 * without CustomerToggleForm needing to know about list state.
 */
export default function CustomerManagement() {
  const { t } = useTranslation();

  const handleSuccess = () => {
    // Placeholder: once a CustomerList component is added, trigger its refresh here.
    // e.g. setRefreshKey(k => k + 1);
  };

  return (
    <section
      style={{
        maxWidth: '64rem',
        margin: '0 auto',
        padding: '2rem 1rem',
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontSize: '1.875rem',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          {t('nav.customers')}
        </h1>
        <p
          style={{
            color: 'var(--color-muted)',
            marginTop: '0.25rem',
            fontSize: '0.875rem',
          }}
        >
          {t('form.subtitle_register')}
        </p>
      </div>

      {/* Registration / reactivation form */}
      <CustomerToggleForm onSuccess={handleSuccess} />
    </section>
  );
}
