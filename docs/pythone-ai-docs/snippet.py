        fg = fg.squeeze(1).t()          # (K, C)
        ff = ff.squeeze(1).t()          # (K, C)
        mse = F.mse_loss(fg, ff)
        fg_n = F.normalize(fg, dim=1)   # vettori unitari per punto
        ff_n = F.normalize(ff, dim=1)
        s_pos = (fg_n * ff_n).sum(dim=1)
        perm = torch.randperm(K, device=dev)
        s_neg = (fg_n * ff_n[perm]).sum(dim=1)
        tau = 0.1
        nce = -torch.log(torch.exp(s_pos / tau) /
                         (torch.exp(s_pos / tau) + torch.exp(s_neg / tau))).mean()
        return mse, nce