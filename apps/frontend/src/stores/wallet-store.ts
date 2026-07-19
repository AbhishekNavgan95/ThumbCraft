import { create } from "zustand"
import { api, getApiErrorMessage } from "@/lib/api-client"

type WalletState = {
  balanceCoins: number | null
  reservedCoins: number | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  reset: () => void
}

export const useWalletStore = create<WalletState>((set) => ({
  balanceCoins: null,
  reservedCoins: null,
  isLoading: false,
  error: null,

  refresh: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.wallet.getBalance()
      set({
        balanceCoins: data.balanceCoins,
        reservedCoins: data.reservedCoins,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      set({
        isLoading: false,
        error: getApiErrorMessage(error, "Failed to load wallet"),
      })
    }
  },

  reset: () =>
    set({
      balanceCoins: null,
      reservedCoins: null,
      isLoading: false,
      error: null,
    }),
}))
