import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Sparkles, Check } from 'lucide-react';
import userPreferencesService from '../../services/userPreferencesService';
import toast from 'react-hot-toast';

const OnboardingModal = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [readingLevel, setReadingLevel] = useState('Intermediate');
  const [readingGoals, setReadingGoals] = useState([]);
  const [timePreferences, setTimePreferences] = useState('Any Time');
  const [bookLengthPreference, setBookLengthPreference] = useState('Any Length');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    try {
      const response = await userPreferencesService.getCategories();
      setCategories(response.categories);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleGoalToggle = (goal) => {
    setReadingGoals(prev => 
      prev.includes(goal) 
        ? prev.filter(g => g !== goal)
        : [...prev, goal]
    );
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    if (selectedCategories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }

    setLoading(true);
    try {
      await userPreferencesService.completeOnboarding({
        preferredCategories: selectedCategories,
        readingLevel,
        readingGoals,
        timePreferences,
        bookLengthPreference
      });
      
      toast.success('Onboarding completed successfully!');
      onComplete();
      onClose();
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error('Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const readingGoalsOptions = [
    'Entertainment',
    'Education', 
    'Professional Development',
    'Personal Growth',
    'Research'
  ];

  const readingLevels = [
    { value: 'Beginner', label: 'Beginner', description: 'New to reading or prefer simple books' },
    { value: 'Intermediate', label: 'Intermediate', description: 'Comfortable with most books' },
    { value: 'Advanced', label: 'Advanced', description: 'Enjoy complex and challenging reads' },
    { value: 'Expert', label: 'Expert', description: 'Seek the most sophisticated literature' }
  ];

  const timeOptions = [
    'Morning', 'Afternoon', 'Evening', 'Night', 'Any Time'
  ];

  const lengthOptions = [
    'Short (1-200 pages)',
    'Medium (200-400 pages)', 
    'Long (400+ pages)',
    'Any Length'
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <BookOpen className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Welcome to BookHub!</h2>
                <p className="text-sm text-gray-500">Let's personalize your reading experience</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-3 bg-gray-50">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((stepNum) => (
                <div
                  key={stepNum}
                  className={`h-2 flex-1 rounded-full ${
                    stepNum <= step ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">Step {step} of 4</p>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 text-primary-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">What genres do you enjoy?</h3>
                  <p className="text-gray-600">Select your favorite book categories to get personalized recommendations</p>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => handleCategoryToggle(category)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedCategories.includes(category)
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {selectedCategories.includes(category) && (
                          <Check className="h-4 w-4" />
                        )}
                        <span className="text-sm font-medium">{category}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">What's your reading level?</h3>
                  <p className="text-gray-600">This helps us recommend books that match your comfort level</p>
                </div>
                
                <div className="space-y-3">
                  {readingLevels.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setReadingLevel(level.value)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        readingLevel === level.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          readingLevel === level.value
                            ? 'border-primary-500 bg-primary-500'
                            : 'border-gray-300'
                        }`}>
                          {readingLevel === level.value && (
                            <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{level.label}</div>
                          <div className="text-sm text-gray-600">{level.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">What are your reading goals?</h3>
                  <p className="text-gray-600">Select all that apply to help us understand your reading motivation</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {readingGoalsOptions.map((goal) => (
                    <button
                      key={goal}
                      onClick={() => handleGoalToggle(goal)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        readingGoals.includes(goal)
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {readingGoals.includes(goal) && (
                          <Check className="h-4 w-4" />
                        )}
                        <span className="text-sm font-medium">{goal}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Reading preferences</h3>
                  <p className="text-gray-600">Tell us about your reading habits and preferences</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      When do you prefer to read?
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {timeOptions.map((time) => (
                        <button
                          key={time}
                          onClick={() => setTimePreferences(time)}
                          className={`p-2 rounded-lg border text-sm ${
                            timePreferences === time
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What book length do you prefer?
                    </label>
                    <div className="space-y-2">
                      {lengthOptions.map((length) => (
                        <button
                          key={length}
                          onClick={() => setBookLengthPreference(length)}
                          className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                            bookLengthPreference === length
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 ${
                              bookLengthPreference === length
                                ? 'border-primary-500 bg-primary-500'
                                : 'border-gray-300'
                            }`}>
                              {bookLengthPreference === length && (
                                <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5" />
                              )}
                            </div>
                            <span className="font-medium">{length}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            
            <div className="flex items-center gap-3">
              {step < 4 ? (
                <button
                  onClick={handleNext}
                  disabled={step === 1 && selectedCategories.length === 0}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={loading || selectedCategories.length === 0}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  )}
                  Complete Setup
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default OnboardingModal;
