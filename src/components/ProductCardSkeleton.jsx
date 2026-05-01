const ProductCardSkeleton = () => {
  return (
    <div className="flex h-full flex-col gap-4 rounded-[28px] border border-line/60 bg-white p-3 shadow-card">
      <div className="aspect-[4/3] w-full animate-pulse rounded-[24px] bg-cream" />
      <div className="flex flex-1 flex-col px-2 pb-2">
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-cream" />
        <div className="mt-3 h-4 w-1/2 animate-pulse rounded-full bg-cream" />
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="space-y-2">
            <div className="h-8 w-24 animate-pulse rounded-full bg-cream" />
            <div className="h-3 w-20 animate-pulse rounded-full bg-cream" />
          </div>
          <div className="h-9 w-16 animate-pulse rounded-sm bg-blush/70" />
        </div>
      </div>
    </div>
  );
};

export default ProductCardSkeleton;
