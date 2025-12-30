export const PageWrapper = ({ children }: { children: React.ReactNode }) => {
	return (
		<div className="bg-background text-foreground">
			<div className="container mx-auto py-25">{children}</div>
		</div>
	);
};
