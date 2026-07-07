import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchPosts } from '../api/blog';
import { BlogPostCard } from '../components/blog/BlogPostCard';
import { CountryFilter } from '../components/blog/CountryFilter';
import { CategoryFilter } from '../components/blog/CategoryFilter';

export default function BlogListPage() {
  const { currentUser, getIdToken } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const itemsPerPage = 12;

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = currentUser ? await getIdToken() : null;
      const response = await fetchPosts(
        {
          category: selectedCategory,
          country: selectedCountry,
          search,
          page,
        },
        token
      );
      // API returns { success: true, data: [...] }
      const posts = response.data || [];
      setPosts(posts);
      setTotal(posts.length > 0 ? posts.length : 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, selectedCountry]);

  useEffect(() => {
    loadPosts();
  }, [page, search, selectedCategory, selectedCountry]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  const totalPages = Math.ceil(total / itemsPerPage);

  const s = {
    page: {
      minHeight: '100vh',
      background: '#06090f',
      color: '#fff',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    },
    header: {
      padding: '24px 32px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(6,9,15,0.95)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    },
    content: {
      padding: '28px 32px',
      maxWidth: 1400,
      margin: '0 auto',
    },
    title: {
      fontFamily: "'Fraunces', serif",
      fontSize: 32,
      fontWeight: 700,
      marginBottom: 8,
      color: '#fff',
    },
    subtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.5)',
      marginBottom: 20,
    },
    filters: {
      display: 'flex',
      gap: 16,
      marginBottom: 24,
      flexWrap: 'wrap',
      alignItems: 'flex-end',
    },
    filterGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 200,
    },
    filterLabel: {
      fontSize: 12,
      fontWeight: 600,
      color: 'rgba(255,255,255,0.5)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    },
    searchBox: {
      display: 'flex',
      gap: 8,
      flex: 1,
      minWidth: 280,
    },
    input: {
      flex: 1,
      padding: '10px 14px',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(255,255,255,0.03)',
      color: '#fff',
      fontFamily: 'inherit',
      fontSize: 13,
    },
    button: (variant) => {
      const base = {
        padding: '10px 20px',
        borderRadius: 8,
        border: 'none',
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.15s',
      };
      if (variant === 'primary') {
        return { ...base, background: '#00d4aa', color: '#06090f' };
      }
      return { ...base, background: 'rgba(0,212,170,0.12)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.25)' };
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 16,
      marginBottom: 32,
    },
    empty: {
      textAlign: 'center',
      padding: '48px 24px',
      color: 'rgba(255,255,255,0.3)',
      fontSize: 14,
    },
    loader: {
      textAlign: 'center',
      padding: '32px 24px',
      color: 'rgba(255,255,255,0.4)',
      fontSize: 14,
    },
    error: {
      padding: '12px 16px',
      borderRadius: 8,
      background: 'rgba(255,107,107,0.12)',
      border: '1px solid rgba(255,107,107,0.25)',
      color: '#ff6b6b',
      fontSize: 14,
      marginBottom: 16,
    },
    pagination: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 24,
    },
    paginationBtn: (active, disabled) => ({
      padding: '8px 12px',
      borderRadius: 6,
      border: `1px solid ${active ? 'rgba(0,212,170,0.4)' : 'rgba(255,255,255,0.1)'}`,
      background: active ? 'rgba(0,212,170,0.12)' : 'transparent',
      color: active ? '#00d4aa' : 'rgba(255,255,255,0.5)',
      fontFamily: 'inherit',
      fontSize: 12,
      fontWeight: active ? 700 : 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }),
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.title}>Travel Stories</div>
        <div style={s.subtitle}>Discover travel experiences from wanderers around the world</div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {/* Filters and Search */}
        <div style={s.filters}>
          {/* Search */}
          <form onSubmit={handleSearch} style={s.searchBox}>
            <input
              type="text"
              placeholder="Search posts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={s.input}
            />
          </form>

          {/* Category Filter */}
          <CategoryFilter
            onCategoryChange={setSelectedCategory}
            selectedCategory={selectedCategory || 'all'}
          />

          {/* Country Filter */}
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Country</label>
            <CountryFilter
              onCountryChange={setSelectedCountry}
              selectedCountry={selectedCountry}
            />
          </div>
        </div>

        {/* Error message */}
        {error && <div style={s.error}>⚠️ {error}</div>}

        {/* Loading state */}
        {loading && <div style={s.loader}>Loading stories…</div>}

        {/* Empty state */}
        {!loading && posts.length === 0 && (
          <div style={s.empty}>No stories found. Try adjusting your filters or search terms.</div>
        )}

        {/* Posts grid */}
        {!loading && posts.length > 0 && (
          <>
            <div style={s.grid}>
              {posts.map((post) => (
                <BlogPostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUser?.uid}
                  onEdit={() => console.log('Edit:', post.id)}
                  onDelete={() => console.log('Delete:', post.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={s.pagination}>
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  style={s.paginationBtn(false, page === 1)}
                >
                  ← Prev
                </button>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                  Page {page} of {totalPages} ({total} total)
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  style={s.paginationBtn(false, page === totalPages)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
