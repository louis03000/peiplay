'use client'

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface ReviewFormProps {
  // bookingId: string; // 移除未使用的 bookingId
  onSubmit: (rating: number, comment: string) => Promise<void>;
  onCancel: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ onSubmit, onCancel }) => {
  const t = useTranslations('review');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(rating, comment);
    } catch (error) {
      console.error('Review submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('rating')}
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${
                rating >= value
                  ? 'bg-yellow-400 text-white'
                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('comment')}
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          rows={4}
          placeholder={t('comment')}
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  );
};

export default ReviewForm; 