cd physdrape_v2
OMP_NUM_THREADS=2 python bench_physdrape_v2.py --selftest     # deve stampare SUMMARY + OK
python train_physdrape_v2.py --selftest                        # regression check modello
# su GPU con dati reali:
python bench_physdrape_v2.py --data_root ./VITON-HD --ckpt ckpt_B.pt --ablation --out report.json