import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import userService from '../../services/userService';
import api from '../../services/axiosConfig';
import { getCurrentUser } from '../../store/slices/authSlice';

const CategoriesOnboarding = () => {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/books/categories');
        const cats = Array.isArray(res.data) ? res.data : (res.data?.categories || []);
        setCategories(cats);
      } catch (e) {
        toast.error('Failed to load categories');
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const toggle = (c) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  const handleContinue = async () => {
    if (selected.size === 0) {
      toast.error('Please choose at least one category');
      return;
    }
    setSaving(true);
    try {
      await userService.updateFavoriteCategories(Array.from(selected));
      await dispatch(getCurrentUser());
      toast.success('Preferences saved');
      navigate('/');
    } catch (e) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card w-full max-w-2xl p-8">
        <h1 className="text-2xl font-bold mb-2">Choose your favorite categories</h1>
        <p className="text-gray-600 mb-6">Select one or more to personalize your feed.</p>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {categories.map((c) => {
              const active = selected.has(c);
              return (
                <button
                  key={c}
                  onClick={() => toggle(c)}
                  className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                    active ? 'bg-primary-100 border-primary-400 text-primary-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-8 flex justify-end">
          <button
            disabled={saving}
            onClick={handleContinue}
            className={`px-5 py-2 rounded-lg text-white ${saving ? 'bg-primary-300' : 'bg-primary-600 hover:bg-primary-700'}`}
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CategoriesOnboarding;


