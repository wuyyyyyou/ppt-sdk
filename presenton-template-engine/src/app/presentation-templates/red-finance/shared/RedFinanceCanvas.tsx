import type { ReactNode } from "react";

type RedFinanceCanvasProps = {
    children: ReactNode;
};

const RedFinanceCanvas = ({ children }: RedFinanceCanvasProps) => {
    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&family=Roboto:wght@300;400;500;700;900&display=swap"
                rel="stylesheet"
            />
            <div
                className="w-full max-w-[1280px] max-h-[720px] aspect-video mx-auto relative overflow-hidden rounded-sm shadow-lg"
                style={{
                    backgroundColor: "var(--background-color,#FFFFFF)",
                    fontFamily: 'var(--body-font-family,Roboto,"Noto Sans SC",sans-serif)',
                }}
            >
                {children}
            </div>
        </>
    );
};

export default RedFinanceCanvas;
