import { useTranslations } from 'next-intl';

interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  reviewer: {
    name: string | null;
  };
}

interface ReviewListProps {
  reviews: Review[];
}

const ReviewList: React.FC<ReviewListProps> = ({ reviews }) => {
  const t = useTranslations('review');

  if (reviews.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        {t('noReviews')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <div
          key={review.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <span
                    key={value}
                    className={`text-lg ${
                      value <= review.rating
                        ? 'text-yellow-400'
                        : 'text-gray-300 dark:text-gray-600'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                {review.reviewer.name || t('anonymous')}
              </span>
            </div>
            <time className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(review.createdAt).toLocaleDateString()}
            </time>
          </div>
          {review.comment && (
            <p className="text-gray-700 dark:text-gray-300">{review.comment}</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default ReviewList; 