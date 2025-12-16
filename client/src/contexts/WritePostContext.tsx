import { createContext, useContext, useState, ReactNode } from "react";

interface WritePostContextType {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  defaultNeighborhood?: string;
  setDefaultNeighborhood: (neighborhood: string) => void;
}

const WritePostContext = createContext<WritePostContextType | undefined>(undefined);

export function WritePostProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [defaultNeighborhood, setDefaultNeighborhood] = useState<string>("서울시 강남구 역삼동");

  return (
    <WritePostContext.Provider
      value={{
        isOpen,
        openModal: () => setIsOpen(true),
        closeModal: () => setIsOpen(false),
        defaultNeighborhood,
        setDefaultNeighborhood,
      }}
    >
      {children}
    </WritePostContext.Provider>
  );
}

export function useWritePost() {
  const context = useContext(WritePostContext);
  if (!context) {
    throw new Error("useWritePost must be used within WritePostProvider");
  }
  return context;
}

